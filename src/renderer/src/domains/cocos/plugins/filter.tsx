/**
 * R2730: BatchInspector 컴포넌트 타입 필터
 * 선택된 노드 중 특정 컴포넌트 타입을 가진 노드만 남기도록 필터링
 */
import React, { useMemo } from 'react'
import type { BatchPluginProps } from './types'
import { t } from '../../../utils/i18n'

// 필터링할 주요 컴포넌트 타입 목록
const FILTER_TYPES = [
  { label: 'Sprite', types: ['cc.Sprite', 'Sprite'] },
  { label: 'Label', types: ['cc.Label', 'Label', 'cc.RichText'] },
  { label: 'Button', types: ['cc.Button', 'Button'] },
  { label: 'Toggle', types: ['cc.Toggle', 'Toggle'] },
  { label: 'Layout', types: ['cc.Layout', 'Layout'] },
  { label: 'ScrollView', types: ['cc.ScrollView', 'ScrollView'] },
  { label: 'Skeleton', types: ['sp.Skeleton'] },
  { label: 'Animation', types: ['cc.Animation', 'Animation', 'cc.AnimationState'] },
  { label: 'Canvas', types: ['cc.Canvas', 'Canvas'] },
  { label: 'Widget', types: ['cc.Widget', 'Widget'] },
] as const

export function FilterPlugin({ nodes, onMultiSelectChange }: BatchPluginProps) {
  // 현재 선택 노드 중 각 타입별 개수 집계
  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>()
    nodes.forEach(node => {
      node.components.forEach(c => {
        FILTER_TYPES.forEach(ft => {
          if ((ft.types as readonly string[]).includes(c.type)) {
            counts.set(ft.label, (counts.get(ft.label) ?? 0) + 1)
          }
        })
      })
    })
    return counts
  }, [nodes])

  const hasAny = typeCounts.size > 0

  if (!hasAny || nodes.length < 2) return null

  const applyFilter = (filterTypes: readonly string[]) => {
    const typeSet = new Set(filterTypes)
    const filtered = nodes.filter(node =>
      node.components.some(c => typeSet.has(c.type))
    )
    if (filtered.length > 0 && onMultiSelectChange) {
      onMultiSelectChange(filtered.map(n => n.uuid))
    }
  }

  const s8: React.CSSProperties = { fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid rgba(99,102,241,0.35)', color: '#818cf8', userSelect: 'none', background: 'rgba(99,102,241,0.04)' }

  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 4, marginTop: 2, marginBottom: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 9, color: '#818cf8', flexShrink: 0 }}>{t('batch.filter.j_filter_r2730', '필터 (R2730)')}</span>
        {FILTER_TYPES.map(ft => {
          const count = typeCounts.get(ft.label) ?? 0
          if (count === 0) return null
          return (
            <span key={ft.label} onClick={() => applyFilter(ft.types)}
              title={`${ft.label} 컴포넌트 보유 노드만 선택 (${count}개)`}
              style={s8}>
              {ft.label} <span style={{ opacity: 0.7 }}>({count})</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}
