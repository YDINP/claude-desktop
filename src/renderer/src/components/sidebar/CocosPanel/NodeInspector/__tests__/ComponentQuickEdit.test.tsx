import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'
import type { CCSceneNode, CCSceneFile, CCSceneComponent } from '@shared/ipc-schema'
import { ComponentQuickEdit } from '../ComponentQuickEdit'

vi.mock('../../../../../utils/i18n', () => ({
  t: (_key: string, fallback?: string) => fallback ?? _key,
}))

vi.mock('../renderers/LabelRenderer', () => ({
  LabelRenderer: () => <div data-testid="LabelRenderer" />,
}))
vi.mock('../renderers/SpriteRenderer', () => ({
  SpriteRenderer: () => <div data-testid="SpriteRenderer" />,
}))
vi.mock('../renderers/ButtonRenderer', () => ({
  ButtonRenderer: () => <div data-testid="ButtonRenderer" />,
}))
vi.mock('../renderers/LayoutRenderer', () => ({
  LayoutRenderer: () => <div data-testid="LayoutRenderer" />,
}))
vi.mock('../renderers/ScrollViewRenderer', () => ({
  ScrollViewRenderer: () => <div data-testid="ScrollViewRenderer" />,
}))
vi.mock('../renderers/AnimationRenderer', () => ({
  AnimationRenderer: () => <div data-testid="AnimationRenderer" />,
}))
vi.mock('../renderers/PhysicsRenderer', () => ({
  PhysicsRenderer: () => <div data-testid="PhysicsRenderer" />,
}))
vi.mock('../renderers/UIRenderer', () => ({
  UIRenderer: () => <div data-testid="UIRenderer" />,
}))
vi.mock('../renderers/EffectsRenderer', () => ({
  EffectsRenderer: () => <div data-testid="EffectsRenderer" />,
}))
vi.mock('../renderers/ParticleRenderer', () => ({
  ParticleRenderer: () => <div data-testid="ParticleRenderer" />,
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

function makeProps(type: string, props: Record<string, unknown> = {}) {
  const comp: CCSceneComponent = { type, props }
  const draft = makeNode([comp])
  return {
    comp, draft,
    applyAndSave: vi.fn(),
    sceneFile: makeSceneFile(),
    origIdx: 0, ci: 0, is3x: false,
    saveScene: vi.fn().mockResolvedValue({ success: true }),
  }
}

// ── 라우팅 ─────────────────────────────────────────────────────────────────────

describe('ComponentQuickEdit — 컴포넌트 타입 라우팅', () => {
  it('cc.Layout → LayoutRenderer', () => {
    const { getByTestId } = render(<ComponentQuickEdit {...makeProps('cc.Layout')} />)
    expect(getByTestId('LayoutRenderer')).toBeTruthy()
  })

  it('cc.Label → LabelRenderer', () => {
    const { getByTestId } = render(<ComponentQuickEdit {...makeProps('cc.Label')} />)
    expect(getByTestId('LabelRenderer')).toBeTruthy()
  })

  it('cc.RichText → LabelRenderer', () => {
    const { getByTestId } = render(<ComponentQuickEdit {...makeProps('cc.RichText')} />)
    expect(getByTestId('LabelRenderer')).toBeTruthy()
  })

  it('cc.LabelOutline → LabelRenderer', () => {
    const { getByTestId } = render(<ComponentQuickEdit {...makeProps('cc.LabelOutline')} />)
    expect(getByTestId('LabelRenderer')).toBeTruthy()
  })

  it('cc.LabelShadow → LabelRenderer', () => {
    const { getByTestId } = render(<ComponentQuickEdit {...makeProps('cc.LabelShadow')} />)
    expect(getByTestId('LabelRenderer')).toBeTruthy()
  })

  it('cc.Sprite → SpriteRenderer', () => {
    const { getByTestId } = render(<ComponentQuickEdit {...makeProps('cc.Sprite')} />)
    expect(getByTestId('SpriteRenderer')).toBeTruthy()
  })

  it('cc.Sprite2D → SpriteRenderer', () => {
    const { getByTestId } = render(<ComponentQuickEdit {...makeProps('cc.Sprite2D')} />)
    expect(getByTestId('SpriteRenderer')).toBeTruthy()
  })

  it('cc.Graphics → SpriteRenderer', () => {
    const { getByTestId } = render(<ComponentQuickEdit {...makeProps('cc.Graphics')} />)
    expect(getByTestId('SpriteRenderer')).toBeTruthy()
  })

  it('cc.VideoPlayer → SpriteRenderer', () => {
    const { getByTestId } = render(<ComponentQuickEdit {...makeProps('cc.VideoPlayer')} />)
    expect(getByTestId('SpriteRenderer')).toBeTruthy()
  })

  it('cc.Button → ButtonRenderer', () => {
    const { getByTestId } = render(<ComponentQuickEdit {...makeProps('cc.Button')} />)
    expect(getByTestId('ButtonRenderer')).toBeTruthy()
  })

  it('cc.Toggle → ButtonRenderer', () => {
    const { getByTestId } = render(<ComponentQuickEdit {...makeProps('cc.Toggle')} />)
    expect(getByTestId('ButtonRenderer')).toBeTruthy()
  })

  it('cc.EditBox → ButtonRenderer', () => {
    const { getByTestId } = render(<ComponentQuickEdit {...makeProps('cc.EditBox')} />)
    expect(getByTestId('ButtonRenderer')).toBeTruthy()
  })

  it('cc.Slider → ButtonRenderer', () => {
    const { getByTestId } = render(<ComponentQuickEdit {...makeProps('cc.Slider')} />)
    expect(getByTestId('ButtonRenderer')).toBeTruthy()
  })

  it('cc.ToggleContainer → ButtonRenderer', () => {
    const { getByTestId } = render(<ComponentQuickEdit {...makeProps('cc.ToggleContainer')} />)
    expect(getByTestId('ButtonRenderer')).toBeTruthy()
  })

  it('cc.Canvas → UIRenderer', () => {
    const { getByTestId } = render(<ComponentQuickEdit {...makeProps('cc.Canvas')} />)
    expect(getByTestId('UIRenderer')).toBeTruthy()
  })

  it('cc.Widget → UIRenderer', () => {
    const { getByTestId } = render(<ComponentQuickEdit {...makeProps('cc.Widget')} />)
    expect(getByTestId('UIRenderer')).toBeTruthy()
  })

  it('cc.ProgressBar → UIRenderer', () => {
    const { getByTestId } = render(<ComponentQuickEdit {...makeProps('cc.ProgressBar')} />)
    expect(getByTestId('UIRenderer')).toBeTruthy()
  })

  it('cc.UIOpacity → UIRenderer', () => {
    const { getByTestId } = render(<ComponentQuickEdit {...makeProps('cc.UIOpacity')} />)
    expect(getByTestId('UIRenderer')).toBeTruthy()
  })

  it('cc.UITransform → UIRenderer', () => {
    const { getByTestId } = render(<ComponentQuickEdit {...makeProps('cc.UITransform')} />)
    expect(getByTestId('UIRenderer')).toBeTruthy()
  })

  it('cc.Mask → UIRenderer', () => {
    const { getByTestId } = render(<ComponentQuickEdit {...makeProps('cc.Mask')} />)
    expect(getByTestId('UIRenderer')).toBeTruthy()
  })

  it('cc.AudioSource → EffectsRenderer', () => {
    const { getByTestId } = render(<ComponentQuickEdit {...makeProps('cc.AudioSource')} />)
    expect(getByTestId('EffectsRenderer')).toBeTruthy()
  })

  it('cc.Camera → EffectsRenderer', () => {
    const { getByTestId } = render(<ComponentQuickEdit {...makeProps('cc.Camera')} />)
    expect(getByTestId('EffectsRenderer')).toBeTruthy()
  })

  it('cc.BlockInputEvents → EffectsRenderer', () => {
    const { getByTestId } = render(<ComponentQuickEdit {...makeProps('cc.BlockInputEvents')} />)
    expect(getByTestId('EffectsRenderer')).toBeTruthy()
  })

  it('cc.MotionStreak → EffectsRenderer', () => {
    const { getByTestId } = render(<ComponentQuickEdit {...makeProps('cc.MotionStreak')} />)
    expect(getByTestId('EffectsRenderer')).toBeTruthy()
  })

  it('cc.DirectionalLight → EffectsRenderer', () => {
    const { getByTestId } = render(<ComponentQuickEdit {...makeProps('cc.DirectionalLight')} />)
    expect(getByTestId('EffectsRenderer')).toBeTruthy()
  })

  it('cc.ParticleSystem → ParticleRenderer', () => {
    const { getByTestId } = render(<ComponentQuickEdit {...makeProps('cc.ParticleSystem')} />)
    expect(getByTestId('ParticleRenderer')).toBeTruthy()
  })

  it('cc.ParticleSystem2D → ParticleRenderer', () => {
    const { getByTestId } = render(<ComponentQuickEdit {...makeProps('cc.ParticleSystem2D')} />)
    expect(getByTestId('ParticleRenderer')).toBeTruthy()
  })

  it('cc.Animation → AnimationRenderer', () => {
    const { getByTestId } = render(<ComponentQuickEdit {...makeProps('cc.Animation')} />)
    expect(getByTestId('AnimationRenderer')).toBeTruthy()
  })

  it('cc.SkeletalAnimation → AnimationRenderer', () => {
    const { getByTestId } = render(<ComponentQuickEdit {...makeProps('cc.SkeletalAnimation')} />)
    expect(getByTestId('AnimationRenderer')).toBeTruthy()
  })

  it('dragonBones.ArmatureDisplay → AnimationRenderer', () => {
    const { getByTestId } = render(<ComponentQuickEdit {...makeProps('dragonBones.ArmatureDisplay')} />)
    expect(getByTestId('AnimationRenderer')).toBeTruthy()
  })

  it('sp.Skeleton → AnimationRenderer', () => {
    const { getByTestId } = render(<ComponentQuickEdit {...makeProps('sp.Skeleton')} />)
    expect(getByTestId('AnimationRenderer')).toBeTruthy()
  })

  it('cc.ScrollView → ScrollViewRenderer', () => {
    const { getByTestId } = render(<ComponentQuickEdit {...makeProps('cc.ScrollView')} />)
    expect(getByTestId('ScrollViewRenderer')).toBeTruthy()
  })

  it('cc.PageView → ScrollViewRenderer', () => {
    const { getByTestId } = render(<ComponentQuickEdit {...makeProps('cc.PageView')} />)
    expect(getByTestId('ScrollViewRenderer')).toBeTruthy()
  })

  it('cc.Scrollbar → ScrollViewRenderer', () => {
    const { getByTestId } = render(<ComponentQuickEdit {...makeProps('cc.Scrollbar')} />)
    expect(getByTestId('ScrollViewRenderer')).toBeTruthy()
  })

  it('cc.BoxCollider → PhysicsRenderer', () => {
    const { getByTestId } = render(<ComponentQuickEdit {...makeProps('cc.BoxCollider')} />)
    expect(getByTestId('PhysicsRenderer')).toBeTruthy()
  })

  it('cc.CircleCollider2D → PhysicsRenderer', () => {
    const { getByTestId } = render(<ComponentQuickEdit {...makeProps('cc.CircleCollider2D')} />)
    expect(getByTestId('PhysicsRenderer')).toBeTruthy()
  })

  it('cc.RigidBody2D → PhysicsRenderer', () => {
    const { getByTestId } = render(<ComponentQuickEdit {...makeProps('cc.RigidBody2D')} />)
    expect(getByTestId('PhysicsRenderer')).toBeTruthy()
  })

  it('미지원 타입 (cc.Unknown) → null 반환', () => {
    const { container } = render(<ComponentQuickEdit {...makeProps('cc.Unknown')} />)
    expect(container.firstChild).toBeNull()
  })

  it('빈 문자열 타입 → null 반환', () => {
    const { container } = render(<ComponentQuickEdit {...makeProps('')} />)
    expect(container.firstChild).toBeNull()
  })
})

// ── 사용자 정의 스크립트 타입 ──────────────────────────────────────────────────

describe('ComponentQuickEdit — 사용자 정의 타입', () => {
  it('사용자 정의 스크립트 타입은 null 반환', () => {
    const { container } = render(<ComponentQuickEdit {...makeProps('MyGame.PlayerController')} />)
    expect(container.firstChild).toBeNull()
  })
})
