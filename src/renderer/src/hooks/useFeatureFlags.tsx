import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { DEFAULT_FEATURES, FEATURE_GROUP_MAP } from '../../../shared/feature-types'
import type { FeatureFlags } from '../../../shared/feature-types'

// ── Context ──────────────────────────────────────────────
interface FeatureFlagsContextValue {
  features: FeatureFlags
  rawFeatures: FeatureFlags
  setFeature: (key: keyof FeatureFlags, enabled: boolean) => void
}

export const FeatureFlagsContext = createContext<FeatureFlagsContextValue | null>(null)

// ── Provider ─────────────────────────────────────────────
export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const [raw, setRaw] = useState<FeatureFlags>(DEFAULT_FEATURES)

  // 초기 로드
  useEffect(() => {
    window.api?.featuresGet?.().then((f: FeatureFlags) => {
      if (f) setRaw(prev => ({ ...prev, ...f }))
    })
  }, [])

  // features:changed 이벤트 구독 (단일 리스너 — Context 레벨)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<Partial<FeatureFlags>>).detail
      setRaw(prev => ({ ...prev, ...detail }))
    }
    window.addEventListener('features:changed', handler)
    return () => window.removeEventListener('features:changed', handler)
  }, [])

  const setFeature = (key: keyof FeatureFlags, enabled: boolean) => {
    // delta만 dispatch — 전체 객체 덮어쓰기 방지
    window.dispatchEvent(new CustomEvent('features:changed', {
      detail: { [key]: enabled } as Partial<FeatureFlags>,
    }))
    window.api?.featuresSet?.(key, enabled)
  }

  // L1 최적화: raw 값이 실제로 변경됐을 때만 effective 재계산
  // FeatureFlags 인터페이스 고정 → 키 순서 안정적 → 직렬화 비교 안전
  const rawValues = Object.values(raw).join(',')
  const features = useMemo<FeatureFlags>(() => {
    const effective = { ...raw }
    for (const [group, children] of Object.entries(FEATURE_GROUP_MAP)) {
      if (!raw[`group.${group}` as keyof FeatureFlags]) {
        for (const child of children) {
          ;(effective as Record<string, boolean>)[child as string] = false
        }
      }
    }
    return effective
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawValues])

  const value = useMemo<FeatureFlagsContextValue>(
    () => ({ features, rawFeatures: raw, setFeature }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [features, raw],
  )

  return (
    <FeatureFlagsContext.Provider value={value}>
      {children}
    </FeatureFlagsContext.Provider>
  )
}

// ── Consumer hook ─────────────────────────────────────────
export function useFeatureFlags() {
  const ctx = useContext(FeatureFlagsContext)
  if (!ctx) throw new Error('useFeatureFlags must be used within FeatureFlagsProvider')
  return ctx
}

export type { FeatureFlags }
