/**
 * BatchPlugin 인터페이스 — 배치 기능 플러그인 타입
 * 각 플러그인은 독립 React 컴포넌트로 자체 상태 관리
 */
import type React from 'react'
import type { CCSceneNode, CCSceneFile } from '../../../../../shared/ipc-schema'

export type BatchPluginGroup =
  | 'transform'
  | 'color'
  | 'distribution'
  | 'name'
  | 'component'
  | 'misc'

export interface BatchPluginProps {
  nodes: CCSceneNode[]           // 선택된 노드 목록
  sceneFile: CCSceneFile
  saveScene: (root: CCSceneNode) => Promise<{ success: boolean; error?: string }>
  onSelectNode: (n: CCSceneNode | null) => void
  onMultiSelectChange?: (uuids: string[]) => void
  lockedUuids?: Set<string>
  onSetLockedUuids?: (updater: (prev: Set<string>) => Set<string>) => void
}

export interface BatchPlugin {
  /** 고유 ID (e.g. 'transform-group', 'color-group') */
  id: string
  /** 표시 그룹 */
  group: BatchPluginGroup
  /** 표시 제목 (그룹 헤더용) */
  title: string
  /** 최소 노드 수 (기본 1) */
  minNodes?: number
  /** 추가 적용 조건 */
  applies?: (nodes: CCSceneNode[]) => boolean
  /** 렌더링 컴포넌트 */
  Component: React.ComponentType<BatchPluginProps>
}

/** 그룹 표시 이름 */
export const GROUP_LABELS: Record<BatchPluginGroup, string> = {
  transform: '변환',
  color: '색상',
  distribution: '분배',
  name: '이름',
  component: '컴포넌트',
  misc: '기타',
}
