import { useState, useRef } from 'react'
import type { CCSceneNode } from '@shared/ipc-schema'

export interface NodeClipboards {
  // transform (full)
  transformClipboard: React.MutableRefObject<{
    position: CCSceneNode['position']
    rotation: CCSceneNode['rotation']
    scale: CCSceneNode['scale']
    size: CCSceneNode['size']
  } | null>
  transformClipFilled: boolean
  setTransformClipFilled: React.Dispatch<React.SetStateAction<boolean>>
  // position
  posClipboard: React.MutableRefObject<{ x: number; y: number } | null>
  posClipFilled: boolean
  setPosClipFilled: React.Dispatch<React.SetStateAction<boolean>>
  // size
  sizeClipboard: React.MutableRefObject<{ w: number; h: number } | null>
  sizeClipFilled: boolean
  setSizeClipFilled: React.Dispatch<React.SetStateAction<boolean>>
  // color
  colorClipboard: React.MutableRefObject<{ r: number; g: number; b: number } | null>
  colorClipFilled: boolean
  setColorClipFilled: React.Dispatch<React.SetStateAction<boolean>>
  // rotation
  rotClipboard: React.MutableRefObject<number | null>
  rotClipFilled: boolean
  setRotClipFilled: React.Dispatch<React.SetStateAction<boolean>>
  // scale
  scaleClipboard: React.MutableRefObject<{ x: number; y: number } | null>
  scaleClipFilled: boolean
  setScaleClipFilled: React.Dispatch<React.SetStateAction<boolean>>
  // opacity
  opacityClipboard: React.MutableRefObject<number | null>
  opacityClipFilled: boolean
  setOpacityClipFilled: React.Dispatch<React.SetStateAction<boolean>>
}

export function useNodeClipboards(): NodeClipboards {
  // R1617: 트랜스폼 복사/붙여넣기 클립보드
  const transformClipboard = useRef<{
    position: CCSceneNode['position']
    rotation: CCSceneNode['rotation']
    scale: CCSceneNode['scale']
    size: CCSceneNode['size']
  } | null>(null)
  const [transformClipFilled, setTransformClipFilled] = useState(false)

  // R2552: 위치 전용 클립보드
  const posClipboard = useRef<{ x: number; y: number } | null>(null)
  const [posClipFilled, setPosClipFilled] = useState(false)

  // R2553: 크기 전용 클립보드
  const sizeClipboard = useRef<{ w: number; h: number } | null>(null)
  const [sizeClipFilled, setSizeClipFilled] = useState(false)

  // R2562: 색상 전용 클립보드
  const colorClipboard = useRef<{ r: number; g: number; b: number } | null>(null)
  const [colorClipFilled, setColorClipFilled] = useState(false)

  // R2563: 회전 전용 클립보드
  const rotClipboard = useRef<number | null>(null)
  const [rotClipFilled, setRotClipFilled] = useState(false)

  // R2564: 스케일 전용 클립보드
  const scaleClipboard = useRef<{ x: number; y: number } | null>(null)
  const [scaleClipFilled, setScaleClipFilled] = useState(false)

  // R2574: 불투명도 전용 클립보드
  const opacityClipboard = useRef<number | null>(null)
  const [opacityClipFilled, setOpacityClipFilled] = useState(false)

  return {
    transformClipboard,
    transformClipFilled,
    setTransformClipFilled,
    posClipboard,
    posClipFilled,
    setPosClipFilled,
    sizeClipboard,
    sizeClipFilled,
    setSizeClipFilled,
    colorClipboard,
    colorClipFilled,
    setColorClipFilled,
    rotClipboard,
    rotClipFilled,
    setRotClipFilled,
    scaleClipboard,
    scaleClipFilled,
    setScaleClipFilled,
    opacityClipboard,
    opacityClipFilled,
    setOpacityClipFilled,
  }
}
