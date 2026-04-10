/**
 * useCCSceneOverlayState — 초기값 + 각 toggle/set 동작 테스트
 */
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCCSceneOverlayState } from '../useCCSceneOverlayState'

describe('useCCSceneOverlayState — 초기값', () => {
  it('gridStyle 초기값은 "line"', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    expect(result.current.gridStyle).toBe('line')
  })

  it('showNodeNames 초기값은 true', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    expect(result.current.showNodeNames).toBe(true)
  })

  it('showZOrder 초기값은 false', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    expect(result.current.showZOrder).toBe(false)
  })

  it('snapSize 초기값은 10', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    expect(result.current.snapSize).toBe(10)
  })

  it('bgColorOverride 초기값은 null', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    expect(result.current.bgColorOverride).toBeNull()
  })

  it('bgPattern 초기값은 "solid"', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    expect(result.current.bgPattern).toBe('solid')
  })

  it('selectionColor 초기값은 "#58a6ff"', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    expect(result.current.selectionColor).toBe('#58a6ff')
  })

  it('showHelp 초기값은 false', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    expect(result.current.showHelp).toBe(false)
  })

  it('showMinimap 초기값은 true', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    expect(result.current.showMinimap).toBe(true)
  })

  it('showRuler 초기값은 false', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    expect(result.current.showRuler).toBe(false)
  })

  it('showCameraFrames 초기값은 true', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    expect(result.current.showCameraFrames).toBe(true)
  })

  it('showGrid 초기값은 false', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    expect(result.current.showGrid).toBe(false)
  })

  it('showCrossGuide 초기값은 false', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    expect(result.current.showCrossGuide).toBe(false)
  })

  it('viewLock 초기값은 false', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    expect(result.current.viewLock).toBe(false)
  })

  it('hideInactiveNodes 초기값은 false', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    expect(result.current.hideInactiveNodes).toBe(false)
  })

  it('labelFontSize 초기값은 11', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    expect(result.current.labelFontSize).toBe(11)
  })

  it('wireframeMode 초기값은 false', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    expect(result.current.wireframeMode).toBe(false)
  })

  it('depthColorMode 초기값은 false', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    expect(result.current.depthColorMode).toBe(false)
  })

  it('depthFilterMax 초기값은 null', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    expect(result.current.depthFilterMax).toBeNull()
  })

  it('soloMode 초기값은 false', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    expect(result.current.soloMode).toBe(false)
  })

  it('resOverride 초기값은 null', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    expect(result.current.resOverride).toBeNull()
  })

  it('compFilterType 초기값은 null', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    expect(result.current.compFilterType).toBeNull()
  })

  it('customRatioW 초기값은 16', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    expect(result.current.customRatioW).toBe(16)
  })

  it('customRatioH 초기값은 9', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    expect(result.current.customRatioH).toBe(9)
  })

  it('showOpacityHud 초기값은 false', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    expect(result.current.showOpacityHud).toBe(false)
  })

  it('showRefArrows 초기값은 false', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    expect(result.current.showRefArrows).toBe(false)
  })
})

describe('useCCSceneOverlayState — toggle 동작', () => {
  it('setGridStyle("dot")로 변경 가능', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    act(() => result.current.setGridStyle('dot'))
    expect(result.current.gridStyle).toBe('dot')
  })

  it('setGridStyle("none")로 변경 가능', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    act(() => result.current.setGridStyle('none'))
    expect(result.current.gridStyle).toBe('none')
  })

  it('setShowNodeNames(false)로 토글', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    act(() => result.current.setShowNodeNames(false))
    expect(result.current.showNodeNames).toBe(false)
  })

  it('setShowZOrder(true)로 토글', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    act(() => result.current.setShowZOrder(true))
    expect(result.current.showZOrder).toBe(true)
  })

  it('setSnapSize(5)로 변경', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    act(() => result.current.setSnapSize(5))
    expect(result.current.snapSize).toBe(5)
  })

  it('setSnapSize(1)로 변경', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    act(() => result.current.setSnapSize(1))
    expect(result.current.snapSize).toBe(1)
  })

  it('setBgColorOverride("#000000")으로 설정', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    act(() => result.current.setBgColorOverride('#000000'))
    expect(result.current.bgColorOverride).toBe('#000000')
  })

  it('setBgColorOverride(null)으로 초기화', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    act(() => result.current.setBgColorOverride('#123456'))
    act(() => result.current.setBgColorOverride(null))
    expect(result.current.bgColorOverride).toBeNull()
  })

  it('setBgPattern("checker")로 변경', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    act(() => result.current.setBgPattern('checker'))
    expect(result.current.bgPattern).toBe('checker')
  })

  it('setSelectionColor("#ff0000")으로 변경', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    act(() => result.current.setSelectionColor('#ff0000'))
    expect(result.current.selectionColor).toBe('#ff0000')
  })

  it('setShowHelp(true)로 토글', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    act(() => result.current.setShowHelp(true))
    expect(result.current.showHelp).toBe(true)
  })

  it('setShowMinimap(false)로 토글', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    act(() => result.current.setShowMinimap(false))
    expect(result.current.showMinimap).toBe(false)
  })

  it('setShowRuler(true)로 토글', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    act(() => result.current.setShowRuler(true))
    expect(result.current.showRuler).toBe(true)
  })

  it('setShowCameraFrames(false)로 토글', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    act(() => result.current.setShowCameraFrames(false))
    expect(result.current.showCameraFrames).toBe(false)
  })

  it('setShowGrid(true)로 토글', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    act(() => result.current.setShowGrid(true))
    expect(result.current.showGrid).toBe(true)
  })

  it('setShowCrossGuide(true)로 토글', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    act(() => result.current.setShowCrossGuide(true))
    expect(result.current.showCrossGuide).toBe(true)
  })

  it('setViewLock(true)로 토글', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    act(() => result.current.setViewLock(true))
    expect(result.current.viewLock).toBe(true)
  })

  it('setHideInactiveNodes(true)로 토글', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    act(() => result.current.setHideInactiveNodes(true))
    expect(result.current.hideInactiveNodes).toBe(true)
  })

  it('setLabelFontSize(14)로 변경', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    act(() => result.current.setLabelFontSize(14))
    expect(result.current.labelFontSize).toBe(14)
  })

  it('setWireframeMode(true)로 토글', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    act(() => result.current.setWireframeMode(true))
    expect(result.current.wireframeMode).toBe(true)
  })

  it('setDepthColorMode(true)로 토글', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    act(() => result.current.setDepthColorMode(true))
    expect(result.current.depthColorMode).toBe(true)
  })

  it('setDepthFilterMax(5)로 설정', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    act(() => result.current.setDepthFilterMax(5))
    expect(result.current.depthFilterMax).toBe(5)
  })

  it('setSoloMode(true)로 토글', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    act(() => result.current.setSoloMode(true))
    expect(result.current.soloMode).toBe(true)
  })

  it('setResOverride({w:1280, h:720})으로 설정', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    act(() => result.current.setResOverride({ w: 1280, h: 720 }))
    expect(result.current.resOverride).toEqual({ w: 1280, h: 720 })
  })

  it('setCompFilterType("cc.Label")으로 설정', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    act(() => result.current.setCompFilterType('cc.Label'))
    expect(result.current.compFilterType).toBe('cc.Label')
  })

  it('setCustomRatioW(4)로 변경', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    act(() => result.current.setCustomRatioW(4))
    expect(result.current.customRatioW).toBe(4)
  })

  it('setCustomRatioH(3)으로 변경', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    act(() => result.current.setCustomRatioH(3))
    expect(result.current.customRatioH).toBe(3)
  })

  it('setShowSafeZone(true)로 토글', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    act(() => result.current.setShowSafeZone(true))
    expect(result.current.showSafeZone).toBe(true)
  })

  it('setShowRuleOfThirds(true)로 토글', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    act(() => result.current.setShowRuleOfThirds(true))
    expect(result.current.showRuleOfThirds).toBe(true)
  })

  it('setShowOOBHighlight(true)로 토글', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    act(() => result.current.setShowOOBHighlight(true))
    expect(result.current.showOOBHighlight).toBe(true)
  })

  it('setShowSelPolyline(true)로 토글', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    act(() => result.current.setShowSelPolyline(true))
    expect(result.current.showSelPolyline).toBe(true)
  })

  it('setShowHierarchyLines(true)로 토글', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    act(() => result.current.setShowHierarchyLines(true))
    expect(result.current.showHierarchyLines).toBe(true)
  })

  it('setShowInactiveDim(true)로 토글', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    act(() => result.current.setShowInactiveDim(true))
    expect(result.current.showInactiveDim).toBe(true)
  })

  it('setShowDepthHeat(true)로 토글', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    act(() => result.current.setShowDepthHeat(true))
    expect(result.current.showDepthHeat).toBe(true)
  })

  it('setShowSiblingHighlight(true)로 토글', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    act(() => result.current.setShowSiblingHighlight(true))
    expect(result.current.showSiblingHighlight).toBe(true)
  })

  it('setShowOpacityHud(true)로 토글', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    act(() => result.current.setShowOpacityHud(true))
    expect(result.current.showOpacityHud).toBe(true)
  })

  it('setShowRefArrows(true)로 토글', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    act(() => result.current.setShowRefArrows(true))
    expect(result.current.showRefArrows).toBe(true)
  })
})

describe('useCCSceneOverlayState — 반환 객체 구조', () => {
  it('반환값에 setGridStyle 함수가 포함됨', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    expect(typeof result.current.setGridStyle).toBe('function')
  })

  it('반환값에 setShowNodeNames 함수가 포함됨', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    expect(typeof result.current.setShowNodeNames).toBe('function')
  })

  it('반환값에 setSnapSize 함수가 포함됨', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    expect(typeof result.current.setSnapSize).toBe('function')
  })

  it('반환값에 setBgColorOverride 함수가 포함됨', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    expect(typeof result.current.setBgColorOverride).toBe('function')
  })

  it('반환값에 setDepthFilterMax 함수가 포함됨', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    expect(typeof result.current.setDepthFilterMax).toBe('function')
  })

  it('반환값에 setResOverride 함수가 포함됨', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    expect(typeof result.current.setResOverride).toBe('function')
  })

  it('반환값에 setCompFilterType 함수가 포함됨', () => {
    const { result } = renderHook(() => useCCSceneOverlayState())
    expect(typeof result.current.setCompFilterType).toBe('function')
  })
})
