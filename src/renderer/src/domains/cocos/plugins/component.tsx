import React, { useState, useMemo } from 'react'
import type { CCSceneNode } from '@shared/ipc-schema'
import { useBatchPatch } from '@renderer/components/sidebar/hooks/useBatchPatch'
import type { BatchPluginProps } from './types'
import type { ComponentSectionProps } from './component-shared'
import { ComponentHeadSection } from './component-head'
import { ColliderSection } from './component-collider'
import { NodeSection } from './component-node'
import { LabelSection } from './component-label'
import { RichTextSection } from './component-richtext'
import { GraphicsSection } from './component-graphics'
import { UiSection } from './component-ui'
import { ButtonSection } from './component-button'
import { ScrollViewSection } from './component-scrollview'
import { MediaSection } from './component-media'
import { ParticleSection } from './component-particle'
import { TilemapCanvasSection } from './component-tilemap-canvas'
import { AudioCameraSection } from './component-audio-camera'
import { LayoutWidgetSection } from './component-layout-widget'
import { PhysicsSection } from './component-physics'
import { SpriteSection } from './component-sprite'
import { Cc3xTailSection } from './component-cc3x-tail'

export function ComponentPlugin({ nodes, sceneFile, saveScene, onMultiSelectChange }: BatchPluginProps) {
  const uuids = nodes.map(n => n.uuid)
  const uuidSet = useMemo(() => new Set(uuids), [uuids])
  const [batchMsg, setBatchMsg] = useState<string | null>(null)
  const { patchNodes, patchComponents, patchOrdered } = useBatchPatch({ sceneFile, saveScene, uuidSet, uuids, setBatchMsg })

  const commonCompTypes = useMemo(() => {
    if (!sceneFile.root) return []
    const nodeArr: CCSceneNode[] = []
    function collectC(n: CCSceneNode) { if (uuidSet.has(n.uuid)) nodeArr.push(n); n.children.forEach(collectC) }
    collectC(sceneFile.root)
    if (nodeArr.length < 2) return []
    const allTypes = nodeArr.map(n => new Set(n.components.map(c => c.type)))
    return [...allTypes[0]].filter(t => allTypes.every(s => s.has(t)))
  }, [sceneFile.root, uuidSet])

  const sectionProps: ComponentSectionProps = {
    uuids, uuidSet, sceneFile, saveScene,
    patchNodes, patchComponents, patchOrdered,
    commonCompTypes, setBatchMsg, onMultiSelectChange,
  }

  return (
    <div>
      {batchMsg && <div style={{ fontSize: 9, color: '#4ade80', marginBottom: 4 }}>{batchMsg}</div>}
      <ComponentHeadSection {...sectionProps} />
      <ColliderSection {...sectionProps} />
      <NodeSection {...sectionProps} />
      <LabelSection {...sectionProps} />
      <RichTextSection {...sectionProps} />
      <GraphicsSection {...sectionProps} />
      <UiSection {...sectionProps} />
      <ButtonSection {...sectionProps} />
      <ScrollViewSection {...sectionProps} />
      <MediaSection {...sectionProps} />
      <ParticleSection {...sectionProps} />
      <TilemapCanvasSection {...sectionProps} />
      <AudioCameraSection {...sectionProps} />
      <LayoutWidgetSection {...sectionProps} />
      <PhysicsSection {...sectionProps} />
      <SpriteSection {...sectionProps} />
      <Cc3xTailSection {...sectionProps} />
    </div>
  )
}
