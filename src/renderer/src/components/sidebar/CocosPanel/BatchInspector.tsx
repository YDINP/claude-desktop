/**
 * CCFileBatchInspector — thin shell
 * 실제 구현은 domains/cocos/plugins/ 플러그인 시스템으로 위임
 *
 * R1553: BatchInspector 스케일(batchScaleX/Y) + 사이즈(batchSizeW/H) 일괄 편집
 *   → domains/cocos/plugins/transform.tsx 에 구현됨
 *
 * R2530: 앵커 변경 시 위치 보정(batchAnchorCompensate) — newPosX/Y 계산 적용
 *   → domains/cocos/plugins/transform.tsx 에 구현됨
 */
import React, { useMemo } from 'react'
import type { CCSceneFile, CCSceneNode } from '../../../../../shared/ipc-schema'
import { getApplicablePlugins } from '../../../domains/cocos'
import type { BatchPluginProps } from '../../../domains/cocos'

interface Props {
  uuids: string[]
  sceneFile: CCSceneFile
  saveScene: (root: CCSceneNode) => Promise<{ success: boolean; error?: string }>
  onSelectNode: (n: CCSceneNode | null) => void
  onMultiSelectChange?: (uuids: string[]) => void
  lockedUuids?: Set<string>
  onSetLockedUuids?: (updater: (prev: Set<string>) => Set<string>) => void
}

export function CCFileBatchInspector({
  uuids,
  sceneFile,
  saveScene,
  onSelectNode,
  onMultiSelectChange,
  lockedUuids,
  onSetLockedUuids,
}: Props) {
  const nodes = useMemo<CCSceneNode[]>(() => {
    if (!sceneFile.root) return []
    const uuidSet = new Set(uuids)
    const result: CCSceneNode[] = []
    function walk(n: CCSceneNode) {
      if (uuidSet.has(n.uuid)) result.push(n)
      n.children.forEach(walk)
    }
    walk(sceneFile.root)
    return result
  }, [uuids, sceneFile.root])

  const plugins = getApplicablePlugins(nodes)

  const pluginProps: BatchPluginProps = {
    nodes,
    sceneFile,
    saveScene,
    onSelectNode,
    onMultiSelectChange,
    lockedUuids,
    onSetLockedUuids,
  }

  if (uuids.length === 0) {
    return <div style={{ padding: 8, fontSize: 10, color: 'var(--text-muted)' }}>노드를 선택하세요.</div>
  }

  return (
    <div style={{ padding: 4 }}>
      {plugins.map(p => (
        <div key={p.id}>
          <p.Component {...pluginProps} />
        </div>
      ))}
    </div>
  )
}
