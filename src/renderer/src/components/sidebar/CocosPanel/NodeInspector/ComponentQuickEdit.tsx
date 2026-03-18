import React from 'react'
import type { CCSceneNode, CCSceneFile } from '@shared/ipc-schema'
import { LayoutRenderer } from './renderers/LayoutRenderer'
import { LabelRenderer } from './renderers/LabelRenderer'
import { SpriteRenderer } from './renderers/SpriteRenderer'
import { ButtonRenderer } from './renderers/ButtonRenderer'
import { ScrollViewRenderer } from './renderers/ScrollViewRenderer'
import { AnimationRenderer } from './renderers/AnimationRenderer'
import { PhysicsRenderer } from './renderers/PhysicsRenderer'
import { UIRenderer } from './renderers/UIRenderer'
import { EffectsRenderer } from './renderers/EffectsRenderer'
import { ParticleRenderer } from './renderers/ParticleRenderer'

interface ComponentQuickEditProps {
  comp: CCSceneNode['components'][number]
  draft: CCSceneNode
  applyAndSave: (patch: Partial<CCSceneNode>) => void
  sceneFile: CCSceneFile
  origIdx: number
  ci: number
  is3x: boolean
  saveScene?: (root: CCSceneNode) => Promise<{ success: boolean; error?: string }>
}

/** Component-type-specific quick edit renderers — routes to specialized renderer files */
export function ComponentQuickEdit(props: ComponentQuickEditProps): React.ReactElement | null {
  const { comp, saveScene } = props
  const t = comp.type

  switch (t) {
    case 'cc.Layout':
      return <LayoutRenderer {...props} />
    case 'cc.Graphics':
    case 'cc.Sprite':
    case 'cc.Sprite2D':
    case 'cc.VideoPlayer':
    case 'cc.WebView':
    case 'cc.TiledMap':
    case 'cc.TiledLayer':
      return <SpriteRenderer {...props} />
    case 'cc.LabelOutline':
    case 'cc.LabelShadow':
    case 'cc.RichText':
    case 'cc.Label':
      return <LabelRenderer {...props} />
    case 'cc.Toggle':
    case 'cc.ToggleContainer':
    case 'cc.EditBox':
    case 'cc.Button':
    case 'cc.Slider':
      return <ButtonRenderer {...props} />
    case 'cc.Canvas':
    case 'cc.Widget':
    case 'cc.ProgressBar':
    case 'cc.UIOpacity':
    case 'cc.UITransform':
    case 'cc.Mask':
      return <UIRenderer {...props} />
    case 'cc.AudioSource':
    case 'cc.Camera':
    case 'cc.DirectionalLight':
    case 'cc.PointLight':
    case 'cc.SpotLight':
    case 'cc.MotionStreak':
    case 'cc.BlockInputEvents':
      return <EffectsRenderer {...props} />
    case 'cc.ParticleSystem':
    case 'cc.ParticleSystem2D':
      return <ParticleRenderer {...props} />
    case 'cc.Animation':
    case 'cc.SkeletalAnimation':
    case 'dragonBones.ArmatureDisplay':
    case 'sp.Skeleton':
      return <AnimationRenderer {...props} />
    case 'cc.PageView':
    case 'cc.PageViewIndicator':
    case 'cc.ScrollView':
    case 'cc.Scrollbar':
      return <ScrollViewRenderer {...props} saveScene={saveScene!} />
    case 'cc.BoxCollider':
    case 'cc.BoxCollider2D':
    case 'cc.CircleCollider':
    case 'cc.CircleCollider2D':
    case 'cc.PolygonCollider':
    case 'cc.PolygonCollider2D':
    case 'cc.RigidBody':
    case 'cc.RigidBody2D':
      return <PhysicsRenderer {...props} />
    default:
      return null
  }
}
