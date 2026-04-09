import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import React from 'react'
import { FeatureFlagsProvider, useFeatureFlags } from '../useFeatureFlags'

// ── mock window.api ───────────────────────────────────────────────────────────

const mockApi = {
  featuresGet: vi.fn().mockResolvedValue(null),
  featuresSet: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
  mockApi.featuresGet.mockResolvedValue(null)
  Object.defineProperty(window, 'api', { value: mockApi, writable: true, configurable: true })
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ── wrapper ───────────────────────────────────────────────────────────────────

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <FeatureFlagsProvider>{children}</FeatureFlagsProvider>
)

// ── tests ─────────────────────────────────────────────────────────────────────

describe('useFeatureFlags', () => {
  it('FeatureFlagsProvider 기본 상태는 DEFAULT_FEATURES와 동일하다', () => {
    const { result } = renderHook(() => useFeatureFlags(), { wrapper })

    expect(result.current.features['group.layout']).toBe(true)
    expect(result.current.features['group.chat']).toBe(true)
    expect(result.current.features.hqMode).toBe(true)
    expect(result.current.features.terminal).toBe(true)
    expect(result.current.features.sessionFork).toBe(true)
    expect(result.current.features.voiceInput).toBe(false)
  })

  it('FeatureFlagsProvider 없이 사용하면 에러를 던진다', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() =>
      renderHook(() => useFeatureFlags())
    ).toThrow('useFeatureFlags must be used within FeatureFlagsProvider')
    consoleSpy.mockRestore()
  })

  it('setFeature 호출 시 features가 업데이트된다', () => {
    const { result } = renderHook(() => useFeatureFlags(), { wrapper })

    act(() => {
      result.current.setFeature('hqMode', false)
    })

    expect(result.current.features.hqMode).toBe(false)
  })

  it('setFeature는 window.api.featuresSet을 호출한다', () => {
    const { result } = renderHook(() => useFeatureFlags(), { wrapper })

    act(() => {
      result.current.setFeature('terminal', false)
    })

    expect(mockApi.featuresSet).toHaveBeenCalledWith('terminal', false)
  })

  it('group.chat 비활성화 시 채팅 자식 피처들이 false가 된다', () => {
    const { result } = renderHook(() => useFeatureFlags(), { wrapper })

    act(() => {
      result.current.setFeature('group.chat', false)
    })

    const { features } = result.current
    expect(features['group.chat']).toBe(false)
    expect(features.sessionFork).toBe(false)
    expect(features.sessionExport).toBe(false)
    expect(features.contextCompress).toBe(false)
    expect(features.autoResume).toBe(false)
    expect(features.voiceInput).toBe(false)
  })

  it('group.layout 비활성화 시 레이아웃 자식 피처들이 false가 된다', () => {
    const { result } = renderHook(() => useFeatureFlags(), { wrapper })

    act(() => {
      result.current.setFeature('group.layout', false)
    })

    const { features } = result.current
    expect(features['group.layout']).toBe(false)
    expect(features.hqMode).toBe(false)
    expect(features.terminal).toBe(false)
    expect(features.webPreview).toBe(false)
    expect(features.splitView).toBe(false)
  })

  it('group.sidebar 비활성화 시 사이드바 자식 피처들이 false가 된다', () => {
    const { result } = renderHook(() => useFeatureFlags(), { wrapper })

    act(() => {
      result.current.setFeature('group.sidebar', false)
    })

    const { features } = result.current
    expect(features['group.sidebar']).toBe(false)
    expect(features.plugins).toBe(false)
    expect(features.connections).toBe(false)
    expect(features.outline).toBe(false)
    expect(features.stats).toBe(false)
    expect(features.sceneview).toBe(false)
    expect(features.git).toBe(false)
  })

  it('group.cc 비활성화 시 cc 자식 피처들이 false가 된다', () => {
    const { result } = renderHook(() => useFeatureFlags(), { wrapper })

    act(() => {
      result.current.setFeature('group.cc', false)
    })

    const { features } = result.current
    expect(features['group.cc']).toBe(false)
    expect(features['cc.assetBrowser']).toBe(false)
    expect(features['cc.buildTab']).toBe(false)
    expect(features['cc.groupPanel']).toBe(false)
    expect(features['cc.backupManager']).toBe(false)
    expect(features['cc.batchInspector']).toBe(false)
    expect(features['cc.sceneValidation']).toBe(false)
  })

  it('group 비활성화 후 재활성화하면 rawFeatures 기준으로 자식이 복원된다', () => {
    const { result } = renderHook(() => useFeatureFlags(), { wrapper })

    act(() => {
      result.current.setFeature('group.sidebar', false)
    })
    expect(result.current.features.plugins).toBe(false)

    act(() => {
      result.current.setFeature('group.sidebar', true)
    })
    // rawFeatures.plugins가 DEFAULT true이므로 복원됨
    expect(result.current.features.plugins).toBe(true)
  })

  it('rawFeatures는 그룹 override 없이 실제 raw 설정값을 반영한다', () => {
    const { result } = renderHook(() => useFeatureFlags(), { wrapper })

    act(() => {
      result.current.setFeature('group.chat', false)
    })

    // features에서 그룹 자식은 false
    expect(result.current.features.sessionFork).toBe(false)
    // rawFeatures는 group만 false이고 sessionFork는 여전히 true
    expect(result.current.rawFeatures['group.chat']).toBe(false)
    expect(result.current.rawFeatures.sessionFork).toBe(true)
  })

  it('features:changed 외부 이벤트로 상태가 업데이트된다', () => {
    const { result } = renderHook(() => useFeatureFlags(), { wrapper })

    act(() => {
      window.dispatchEvent(
        new CustomEvent('features:changed', { detail: { hqMode: false } })
      )
    })

    expect(result.current.features.hqMode).toBe(false)
  })

  it('featuresGet API로 초기 값을 로드한다', async () => {
    mockApi.featuresGet.mockResolvedValue({ hqMode: false, terminal: false })

    const { result } = renderHook(() => useFeatureFlags(), { wrapper })

    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.features.hqMode).toBe(false)
    expect(result.current.features.terminal).toBe(false)
  })

  it('featuresGet이 null을 반환하면 DEFAULT_FEATURES를 유지한다', async () => {
    mockApi.featuresGet.mockResolvedValue(null)

    const { result } = renderHook(() => useFeatureFlags(), { wrapper })

    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.features.hqMode).toBe(true)
  })
})
