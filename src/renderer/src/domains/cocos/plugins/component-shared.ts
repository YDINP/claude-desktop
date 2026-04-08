import type React from 'react'
import type { CCSceneNode, CCSceneFile } from '@shared/ipc-schema'

export interface ComponentSectionProps {
  uuids: string[]
  uuidSet: Set<string>
  sceneFile: CCSceneFile
  saveScene: (root: CCSceneNode) => Promise<{ success: boolean; error?: string }>
  patchNodes: (fn: (n: CCSceneNode) => CCSceneNode, msg: string) => Promise<void>
  patchComponents: (
    filter: (c: CCSceneNode['components'][number]) => boolean,
    updater: (c: CCSceneNode['components'][number]) => CCSceneNode['components'][number],
    msg: string,
  ) => Promise<void>
  patchOrdered: (fn: (n: CCSceneNode, idx: number) => CCSceneNode, msg: string) => Promise<void>
  commonCompTypes: string[]
  setBatchMsg: (msg: string | null) => void
  onMultiSelectChange?: (uuids: string[]) => void
}

export const mkBtnS = (color: string, extra?: React.CSSProperties): React.CSSProperties => ({
  fontSize: 9, padding: '1px 5px', cursor: 'pointer',
  border: '1px solid var(--border)', borderRadius: 2,
  color, userSelect: 'none', ...extra,
})
export const mkBtnTint = (rgb: string, hex: string, extra?: React.CSSProperties): React.CSSProperties => ({
  fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
  border: `1px solid rgba(${rgb},0.4)`, color: hex,
  userSelect: 'none', background: `rgba(${rgb},0.05)`, ...extra,
})
export const mkNiS = (w: number, padding = '1px 3px'): React.CSSProperties => ({
  width: w, fontSize: 9, padding, border: '1px solid var(--border)',
  borderRadius: 2, background: 'var(--bg-secondary)',
  color: 'var(--text-primary)', textAlign: 'center',
})
