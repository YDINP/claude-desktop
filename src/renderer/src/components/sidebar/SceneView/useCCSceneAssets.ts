import { useEffect, useRef, useState } from 'react'
import type { CCSceneFile } from '../../../../../shared/ipc-schema'
import type { FlatNode } from './ccSceneTypes'

export interface SpriteFrame { x: number; y: number; w: number; h: number; rotated: boolean }
export interface SpriteEntry { dataUrl: string; w: number; h: number; bL: number; bR: number; bT: number; bB: number; frame?: SpriteFrame | null }
export interface FontEntry { dataUrl: string; familyName: string }

/**
 * Sprite texture + Font loading effects for CCFileSceneView.
 * Resolves sprite UUIDs and font UUIDs asynchronously from the project assets directory.
 */
export function useCCSceneAssets(sceneFile: CCSceneFile, flatNodes: FlatNode[]) {
  const spriteCacheRef = useRef<Map<string, SpriteEntry>>(new Map())
  const [, setSpriteCacheVer] = useState(0)
  const fontCacheRef = useRef<Map<string, FontEntry>>(new Map())
  const [fontCacheVer, setFontCacheVer] = useState(0)

  // Sprite UUID -> base64 data URL
  useEffect(() => {
    const assetsDir = sceneFile.projectInfo.assetsDir
    if (!assetsDir) return
    const spriteComps = flatNodes.flatMap(fn =>
      fn.node.components.filter(c => c.type === 'cc.Sprite' || c.type === 'Sprite' || c.type === 'cc.Sprite2D')
    )
    const uuids = spriteComps
      .map(c => (c.props.spriteFrame as { __uuid__?: string } | undefined)?.__uuid__)
      .filter((u): u is string => !!u && !spriteCacheRef.current.has(u))
    if (!uuids.length) return
    uuids.forEach(uuid => {
      spriteCacheRef.current.set(uuid, { dataUrl: '', w: 0, h: 0, bL: 0, bR: 0, bT: 0, bB: 0, frame: null })
      const spritePromise = window.api.ccFileResolveSprite
        ? window.api.ccFileResolveSprite(uuid, assetsDir)
        : window.api.ccFileResolveTexture?.(uuid, assetsDir).then(url =>
            url ? { dataUrl: url, borderTop: 0, borderBottom: 0, borderLeft: 0, borderRight: 0 } : null
          )
      spritePromise?.then(result => {
        if (result) {
          const img = new Image()
          img.onload = () => {
            spriteCacheRef.current.set(uuid, {
              dataUrl: result.dataUrl, w: img.naturalWidth, h: img.naturalHeight,
              bL: result.borderLeft, bR: result.borderRight, bT: result.borderTop, bB: result.borderBottom,
              frame: result.frame ?? null,
            })
            setSpriteCacheVer(v => v + 1)
          }
          img.onerror = () => {
            spriteCacheRef.current.set(uuid, { dataUrl: result.dataUrl, w: 0, h: 0, bL: 0, bR: 0, bT: 0, bB: 0, frame: null })
            setSpriteCacheVer(v => v + 1)
          }
          img.src = result.dataUrl
        } else {
          spriteCacheRef.current.delete(uuid)
          setSpriteCacheVer(v => v + 1)
        }
      })?.catch(() => {
        spriteCacheRef.current.delete(uuid)
      })
    })
  }, [sceneFile, flatNodes])

  // Font loading: cc.Label font UUID -> TTF base64
  useEffect(() => {
    const assetsDir = sceneFile?.projectInfo?.assetsDir
    if (!assetsDir) return
    const labelComps = flatNodes.flatMap(fn =>
      fn.node.components.filter(c => c.type === 'cc.Label' || c.type === 'cc.RichText')
    )
    const uuids = labelComps
      .map(c => (c.props.font as { __uuid__?: string } | undefined)?.__uuid__
             ?? (c.props._font as { __uuid__?: string } | undefined)?.__uuid__
             ?? (c.props._N$file as { __uuid__?: string } | undefined)?.__uuid__
             ?? (c.props.file as { __uuid__?: string } | undefined)?.__uuid__
             ?? (c.props._file as { __uuid__?: string } | undefined)?.__uuid__)
      .filter((u): u is string => !!u && !fontCacheRef.current.has(u))
    const uniqueUuids = [...new Set(uuids)]
    if (!uniqueUuids.length) return
    let cancelled = false
    uniqueUuids.forEach(uuid => {
      fontCacheRef.current.set(uuid, { dataUrl: '', familyName: '' })
      window.api.ccFileResolveFont?.(uuid, assetsDir).then((result: { dataUrl: string; familyName: string } | null) => {
        if (cancelled) return
        if (result) {
          fontCacheRef.current.set(uuid, result)
        } else {
          fontCacheRef.current.delete(uuid)
        }
        setFontCacheVer(v => v + 1)
      }).catch(() => { if (!cancelled) fontCacheRef.current.delete(uuid) })
    })
    return () => {
      cancelled = true
      uniqueUuids.forEach(uuid => {
        const entry = fontCacheRef.current.get(uuid)
        if (entry && !entry.dataUrl) fontCacheRef.current.delete(uuid)
      })
    }
  }, [sceneFile, flatNodes])

  return { spriteCacheRef, fontCacheRef, fontCacheVer }
}
