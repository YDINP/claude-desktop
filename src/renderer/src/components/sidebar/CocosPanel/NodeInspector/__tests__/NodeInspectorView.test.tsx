import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import type { CCSceneNode, CCSceneFile, CCSceneComponent } from '@shared/ipc-schema'
import {
  COMP_ICONS,
  COMP_DESCRIPTIONS,
  COLLAPSED_COMPS_KEY,
  PROP_HISTORY_KEY,
  NOTES_KEY,
  RECENT_COMPS_KEY,
  STYLE_PRESETS_KEY,
  FAV_PROPS_KEY,
} from '../constants'
import { SpriteThumb } from '../constants'

// window.api mock
beforeAll(() => {
  Object.defineProperty(window, 'api', {
    value: {
      ccFileResolveTexture: vi.fn().mockResolvedValue(null),
    },
    writable: true,
  })
})

// ── COMP_ICONS 상수 ──────────────────────────────────────────────────────────

describe('COMP_ICONS (NodeInspector)', () => {
  it('cc.Label → T', () => {
    expect(COMP_ICONS['cc.Label']).toBe('T')
  })

  it('cc.RichText → T', () => {
    expect(COMP_ICONS['cc.RichText']).toBe('T')
  })

  it('cc.Sprite → 🖼', () => {
    expect(COMP_ICONS['cc.Sprite']).toBe('🖼')
  })

  it('cc.Button → ⬜', () => {
    expect(COMP_ICONS['cc.Button']).toBe('⬜')
  })

  it('cc.Toggle → ☑', () => {
    expect(COMP_ICONS['cc.Toggle']).toBe('☑')
  })

  it('cc.Layout → ▤', () => {
    expect(COMP_ICONS['cc.Layout']).toBe('▤')
  })

  it('cc.ScrollView → ⊠', () => {
    expect(COMP_ICONS['cc.ScrollView']).toBe('⊠')
  })

  it('cc.EditBox → ✏', () => {
    expect(COMP_ICONS['cc.EditBox']).toBe('✏')
  })

  it('cc.AudioSource → ♪', () => {
    expect(COMP_ICONS['cc.AudioSource']).toBe('♪')
  })

  it('cc.Canvas → 🎨', () => {
    expect(COMP_ICONS['cc.Canvas']).toBe('🎨')
  })

  it('cc.Camera → 📷', () => {
    expect(COMP_ICONS['cc.Camera']).toBe('📷')
  })

  it('cc.ParticleSystem → ✦', () => {
    expect(COMP_ICONS['cc.ParticleSystem']).toBe('✦')
  })
})

// ── COMP_DESCRIPTIONS 상수 ────────────────────────────────────────────────────

describe('COMP_DESCRIPTIONS (NodeInspector)', () => {
  it('cc.Label 설명이 존재한다', () => {
    expect(COMP_DESCRIPTIONS['cc.Label']).toBeTruthy()
  })

  it('cc.Sprite 설명이 존재한다', () => {
    expect(COMP_DESCRIPTIONS['cc.Sprite']).toBeTruthy()
  })

  it('cc.Button 설명에 "버튼"이 포함된다', () => {
    expect(COMP_DESCRIPTIONS['cc.Button']).toContain('버튼')
  })

  it('cc.Widget 설명에 "위젯"이 포함된다', () => {
    expect(COMP_DESCRIPTIONS['cc.Widget']).toContain('위젯')
  })

  it('cc.AudioSource 설명에 "오디오"가 포함된다', () => {
    expect(COMP_DESCRIPTIONS['cc.AudioSource']).toContain('오디오')
  })

  it('존재하지 않는 컴포넌트 타입은 undefined이다', () => {
    expect(COMP_DESCRIPTIONS['cc.Unknown']).toBeUndefined()
  })
})

// ── localStorage 키 상수 ────────────────────────────────────────────────────

describe('NodeInspector localStorage 키 상수', () => {
  it('COLLAPSED_COMPS_KEY는 문자열이다', () => {
    expect(typeof COLLAPSED_COMPS_KEY).toBe('string')
  })

  it('PROP_HISTORY_KEY는 문자열이다', () => {
    expect(typeof PROP_HISTORY_KEY).toBe('string')
  })

  it('NOTES_KEY는 문자열이다', () => {
    expect(typeof NOTES_KEY).toBe('string')
  })

  it('RECENT_COMPS_KEY는 문자열이다', () => {
    expect(typeof RECENT_COMPS_KEY).toBe('string')
  })

  it('STYLE_PRESETS_KEY는 문자열이다', () => {
    expect(typeof STYLE_PRESETS_KEY).toBe('string')
  })

  it('FAV_PROPS_KEY는 문자열이다', () => {
    expect(typeof FAV_PROPS_KEY).toBe('string')
  })

  it('모든 키가 서로 다르다', () => {
    const keys = new Set([COLLAPSED_COMPS_KEY, PROP_HISTORY_KEY, NOTES_KEY, RECENT_COMPS_KEY, STYLE_PRESETS_KEY, FAV_PROPS_KEY])
    expect(keys.size).toBe(6)
  })
})

// ── SpriteThumb ──────────────────────────────────────────────────────────────

describe('SpriteThumb', () => {
  it('url이 null이면 아무것도 렌더링하지 않는다', () => {
    const { container } = render(<SpriteThumb sfUuid="test-uuid" assetsDir="/fake/assets" />)
    // api.ccFileResolveTexture가 null 반환 → img가 없어야 함
    expect(container.querySelector('img')).toBeNull()
  })
})
