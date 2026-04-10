import { describe, it, expect } from 'vitest'
import {
  DEFAULT_FEATURES,
  FEATURE_GROUP_MAP,
  type FeatureFlags,
  type FeatureGroup,
} from '../feature-types'

// ── DEFAULT_FEATURES ──────────────────────────────────────────────────────────

describe('DEFAULT_FEATURES', () => {
  it('모든 그룹 키가 true이다', () => {
    expect(DEFAULT_FEATURES['group.layout']).toBe(true)
    expect(DEFAULT_FEATURES['group.chat']).toBe(true)
    expect(DEFAULT_FEATURES['group.sidebar']).toBe(true)
    expect(DEFAULT_FEATURES['group.cc']).toBe(true)
  })

  it('voiceInput만 false이다', () => {
    expect(DEFAULT_FEATURES.voiceInput).toBe(false)
  })

  it('layout 자식 기능은 모두 true이다', () => {
    expect(DEFAULT_FEATURES.hqMode).toBe(true)
    expect(DEFAULT_FEATURES.terminal).toBe(true)
    expect(DEFAULT_FEATURES.webPreview).toBe(true)
    expect(DEFAULT_FEATURES.splitView).toBe(true)
  })

  it('chat 자식 기능 (voiceInput 제외)은 모두 true이다', () => {
    expect(DEFAULT_FEATURES.sessionFork).toBe(true)
    expect(DEFAULT_FEATURES.sessionExport).toBe(true)
    expect(DEFAULT_FEATURES.contextCompress).toBe(true)
    expect(DEFAULT_FEATURES.autoResume).toBe(true)
  })

  it('sidebar 자식 기능은 모두 true이다', () => {
    expect(DEFAULT_FEATURES.plugins).toBe(true)
    expect(DEFAULT_FEATURES.connections).toBe(true)
    expect(DEFAULT_FEATURES.outline).toBe(true)
    expect(DEFAULT_FEATURES.stats).toBe(true)
    expect(DEFAULT_FEATURES.sceneview).toBe(true)
    expect(DEFAULT_FEATURES.git).toBe(true)
  })

  it('cc 자식 기능은 모두 true이다', () => {
    expect(DEFAULT_FEATURES['cc.assetBrowser']).toBe(true)
    expect(DEFAULT_FEATURES['cc.buildTab']).toBe(true)
    expect(DEFAULT_FEATURES['cc.groupPanel']).toBe(true)
    expect(DEFAULT_FEATURES['cc.backupManager']).toBe(true)
    expect(DEFAULT_FEATURES['cc.batchInspector']).toBe(true)
    expect(DEFAULT_FEATURES['cc.sceneValidation']).toBe(true)
  })

  it('DEFAULT_FEATURES의 모든 키가 boolean 타입이다', () => {
    for (const [k, v] of Object.entries(DEFAULT_FEATURES)) {
      expect(typeof v, `key: ${k}`).toBe('boolean')
    }
  })

  it('FeatureFlags 인터페이스 키를 모두 포함한다 (타입 안전성)', () => {
    // 컴파일 타임 검증: 아래 코드가 타입 에러 없이 동작하면 통과
    const flags: FeatureFlags = { ...DEFAULT_FEATURES }
    expect(flags['group.layout']).toBe(true)
  })

  it('voiceInput을 제외한 나머지 기능이 22개 이상이다', () => {
    const trueCount = Object.values(DEFAULT_FEATURES).filter(Boolean).length
    expect(trueCount).toBeGreaterThanOrEqual(22)
  })
})

// ── FEATURE_GROUP_MAP ─────────────────────────────────────────────────────────

describe('FEATURE_GROUP_MAP', () => {
  it('4개 그룹 키가 존재한다', () => {
    const keys = Object.keys(FEATURE_GROUP_MAP) as FeatureGroup[]
    expect(keys).toHaveLength(4)
    expect(keys).toContain('layout')
    expect(keys).toContain('chat')
    expect(keys).toContain('sidebar')
    expect(keys).toContain('cc')
  })

  it('layout 그룹에 4개 자식이 있다', () => {
    expect(FEATURE_GROUP_MAP.layout).toHaveLength(4)
    expect(FEATURE_GROUP_MAP.layout).toContain('hqMode')
    expect(FEATURE_GROUP_MAP.layout).toContain('terminal')
    expect(FEATURE_GROUP_MAP.layout).toContain('webPreview')
    expect(FEATURE_GROUP_MAP.layout).toContain('splitView')
  })

  it('chat 그룹에 5개 자식이 있다', () => {
    expect(FEATURE_GROUP_MAP.chat).toHaveLength(5)
    expect(FEATURE_GROUP_MAP.chat).toContain('voiceInput')
    expect(FEATURE_GROUP_MAP.chat).toContain('sessionFork')
    expect(FEATURE_GROUP_MAP.chat).toContain('contextCompress')
    expect(FEATURE_GROUP_MAP.chat).toContain('autoResume')
  })

  it('sidebar 그룹에 6개 자식이 있다', () => {
    expect(FEATURE_GROUP_MAP.sidebar).toHaveLength(6)
    expect(FEATURE_GROUP_MAP.sidebar).toContain('plugins')
    expect(FEATURE_GROUP_MAP.sidebar).toContain('sceneview')
    expect(FEATURE_GROUP_MAP.sidebar).toContain('git')
  })

  it('cc 그룹에 6개 자식이 있다', () => {
    expect(FEATURE_GROUP_MAP.cc).toHaveLength(6)
    expect(FEATURE_GROUP_MAP.cc).toContain('cc.assetBrowser')
    expect(FEATURE_GROUP_MAP.cc).toContain('cc.sceneValidation')
  })

  it('모든 자식 키가 DEFAULT_FEATURES에 존재한다', () => {
    for (const [group, children] of Object.entries(FEATURE_GROUP_MAP)) {
      for (const key of children) {
        expect(
          key in DEFAULT_FEATURES,
          `${group} → ${String(key)} should exist in DEFAULT_FEATURES`
        ).toBe(true)
      }
    }
  })

  it('자식 키가 그룹 간에 중복되지 않는다', () => {
    const all: string[] = []
    for (const children of Object.values(FEATURE_GROUP_MAP)) {
      all.push(...children.map(String))
    }
    const unique = new Set(all)
    expect(unique.size).toBe(all.length)
  })

  it('그룹 키 자체(group.*)는 자식 목록에 포함되지 않는다', () => {
    for (const children of Object.values(FEATURE_GROUP_MAP)) {
      for (const key of children) {
        expect(String(key).startsWith('group.')).toBe(false)
      }
    }
  })
})
