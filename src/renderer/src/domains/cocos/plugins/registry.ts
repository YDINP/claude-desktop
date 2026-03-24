/**
 * Plugin Registry — BatchPlugin 등록 및 조회
 */
import type { BatchPlugin, BatchPluginProps } from './types'
import { TransformPlugin } from './transform'
import { ColorPlugin } from './color'
import { DistributionPlugin } from './distribution'
import { NamePlugin } from './name'
import { ComponentPlugin } from './component'
import { MiscPlugin } from './misc'
import { PresetPlugin } from './preset'
import { FilterPlugin } from './filter'
import { HistoryPlugin } from './history'

/** 등록된 모든 배치 플러그인 */
export const BATCH_PLUGINS: BatchPlugin[] = [
  {
    id: 'transform-group',
    group: 'transform',
    title: '변환',
    minNodes: 1,
    Component: TransformPlugin,
  },
  {
    id: 'color-group',
    group: 'color',
    title: '색상',
    minNodes: 1,
    Component: ColorPlugin,
  },
  {
    id: 'distribution-group',
    group: 'distribution',
    title: '분배',
    minNodes: 2,
    Component: DistributionPlugin,
  },
  {
    id: 'name-group',
    group: 'name',
    title: '이름',
    minNodes: 1,
    Component: NamePlugin,
  },
  {
    id: 'component-group',
    group: 'component',
    title: '컴포넌트',
    minNodes: 1,
    Component: ComponentPlugin,
  },
  {
    id: 'misc-group',
    group: 'misc',
    title: '기타',
    minNodes: 1,
    Component: MiscPlugin,
  },
  {
    id: 'filter-group',
    group: 'misc',
    title: '필터',
    minNodes: 2,
    Component: FilterPlugin,
  },
  {
    id: 'preset-group',
    group: 'misc',
    title: '프리셋',
    minNodes: 1,
    Component: PresetPlugin,
  },
  {
    id: 'history-group',
    group: 'misc',
    title: '편집 이력',
    minNodes: 0,
    Component: HistoryPlugin,
  },
]

/**
 * 현재 선택 노드에 적용 가능한 플러그인 목록 반환
 * - minNodes 이상일 때만 포함
 * - applies 함수가 있으면 추가 조건 검사
 */
export function getApplicablePlugins(
  nodes: BatchPluginProps['nodes'],
): BatchPlugin[] {
  return BATCH_PLUGINS.filter(plugin => {
    if (nodes.length < (plugin.minNodes ?? 1)) return false
    if (plugin.applies && !plugin.applies(nodes)) return false
    return true
  })
}
