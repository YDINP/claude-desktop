import { useState } from 'react'

/** All overlay toggle states bundled for CCFileSceneView toolbar/overlays. */
export function useCCSceneOverlayState() {
  const [gridStyle, setGridStyle] = useState<'line' | 'dot' | 'none'>('line')
  const [showNodeNames, setShowNodeNames] = useState(true)
  const [showZOrder, setShowZOrder] = useState(false)
  const [snapSize, setSnapSize] = useState(10)
  const [bgColorOverride, setBgColorOverride] = useState<string | null>(null)
  const [bgPattern, setBgPattern] = useState<'solid' | 'checker'>('solid')
  const [selectionColor, setSelectionColor] = useState('#58a6ff')
  const [showHelp, setShowHelp] = useState(false)
  const [showMinimap, setShowMinimap] = useState(true)
  const [showRuler, setShowRuler] = useState(false)
  const [showCameraFrames, setShowCameraFrames] = useState(true)
  const [showGrid, setShowGrid] = useState(false)
  const [showCrossGuide, setShowCrossGuide] = useState(false)
  const [showEdgeGuides, setShowEdgeGuides] = useState(false)
  const [showUserGuides, setShowUserGuides] = useState(false)
  const [viewLock, setViewLock] = useState(false)
  const [hideInactiveNodes, setHideInactiveNodes] = useState(false)
  const [labelFontSize, setLabelFontSize] = useState(11)
  const [showSiblingGroup, setShowSiblingGroup] = useState(false)
  const [wireframeMode, setWireframeMode] = useState(false)
  const [depthColorMode, setDepthColorMode] = useState(false)
  const [depthFilterMax, setDepthFilterMax] = useState<number | null>(null)
  const [soloMode, setSoloMode] = useState(false)
  const [showResPicker, setShowResPicker] = useState(false)
  const [resOverride, setResOverride] = useState<{ w: number; h: number } | null>(null)
  const [showWorldPos, setShowWorldPos] = useState(false)
  const [compFilterType, setCompFilterType] = useState<string | null>(null)
  const [showLabelText, setShowLabelText] = useState(false)
  const [showSceneStats, setShowSceneStats] = useState(false)
  const [showOverlayPanel, setShowOverlayPanel] = useState(false)
  const [showToolPanel, setShowToolPanel] = useState(false)
  const [showSizeLabels, setShowSizeLabels] = useState(false)
  const [showOpacityLabels, setShowOpacityLabels] = useState(false)
  const [showCompBadges, setShowCompBadges] = useState(false)
  const [showRotLabels, setShowRotLabels] = useState(false)
  const [showNameLabels, setShowNameLabels] = useState(false)
  const [showAnchorOverlay, setShowAnchorOverlay] = useState(false)
  const [showColorSwatch, setShowColorSwatch] = useState(false)
  const [showChildCountBadge, setShowChildCountBadge] = useState(false)
  const [showDepthLabel, setShowDepthLabel] = useState(false)
  const [showFlipOverlay, setShowFlipOverlay] = useState(false)
  const [showSelBBox, setShowSelBBox] = useState(false)
  const [showCompBadge, setShowCompBadge] = useState(false)
  const [showTagBadge, setShowTagBadge] = useState(false)
  const [showDupNameOverlay, setShowDupNameOverlay] = useState(false)
  const [showRotArrow, setShowRotArrow] = useState(false)
  const [showSizeOverlay, setShowSizeOverlay] = useState(false)
  const [showOriginCross, setShowOriginCross] = useState(false)
  const [showScaleLabel, setShowScaleLabel] = useState(false)
  const [showLayerBadge, setShowLayerBadge] = useState(false)
  const [showEventBadge, setShowEventBadge] = useState(false)
  const [showSafeZone, setShowSafeZone] = useState(false)
  const [showRuleOfThirds, setShowRuleOfThirds] = useState(false)
  const [showCustomRatio, setShowCustomRatio] = useState(false)
  const [customRatioW, setCustomRatioW] = useState(16)
  const [customRatioH, setCustomRatioH] = useState(9)
  const [showOOBHighlight, setShowOOBHighlight] = useState(false)
  const [showSceneBBox, setShowSceneBBox] = useState(false)
  const [showSelOrder, setShowSelOrder] = useState(false)
  const [showAnchorDot, setShowAnchorDot] = useState(false)
  const [showSelPolyline, setShowSelPolyline] = useState(false)
  const [showHierarchyLines, setShowHierarchyLines] = useState(false)
  const [showSelGroupBBox, setShowSelGroupBBox] = useState(false)
  const [showParentHighlight, setShowParentHighlight] = useState(false)
  const [showInactiveDim, setShowInactiveDim] = useState(false)
  const [showColorViz, setShowColorViz] = useState(false)
  const [showCrosshair, setShowCrosshair] = useState(false)
  const [showDepthHeat, setShowDepthHeat] = useState(false)
  const [showOpacityOverlay, setShowOpacityOverlay] = useState(false)
  const [showRotOverlay, setShowRotOverlay] = useState(false)
  const [showPosText, setShowPosText] = useState(false)
  const [showScaleText, setShowScaleText] = useState(false)
  const [showCompCountBadge, setShowCompCountBadge] = useState(false)
  const [showSizeHeat, setShowSizeHeat] = useState(false)
  const [showSelCenter, setShowSelCenter] = useState(false)
  const [showPairDist, setShowPairDist] = useState(false)
  const [showSpriteName, setShowSpriteName] = useState(false)
  const [showUuidBadge, setShowUuidBadge] = useState(false)
  const [showCenterDot, setShowCenterDot] = useState(false)
  const [showNonDefaultAnchor, setShowNonDefaultAnchor] = useState(false)
  const [showZeroSizeWarn, setShowZeroSizeWarn] = useState(false)
  const [showSelAxisLine, setShowSelAxisLine] = useState(false)
  const [showSiblingHighlight, setShowSiblingHighlight] = useState(false)
  const [showOpacityHud, setShowOpacityHud] = useState(false)
  const [showRefArrows, setShowRefArrows] = useState(false)

  return {
    gridStyle, setGridStyle,
    showNodeNames, setShowNodeNames,
    showZOrder, setShowZOrder,
    snapSize, setSnapSize,
    bgColorOverride, setBgColorOverride,
    bgPattern, setBgPattern,
    selectionColor, setSelectionColor,
    showHelp, setShowHelp,
    showMinimap, setShowMinimap,
    showRuler, setShowRuler,
    showCameraFrames, setShowCameraFrames,
    showGrid, setShowGrid,
    showCrossGuide, setShowCrossGuide,
    showEdgeGuides, setShowEdgeGuides,
    showUserGuides, setShowUserGuides,
    viewLock, setViewLock,
    hideInactiveNodes, setHideInactiveNodes,
    labelFontSize, setLabelFontSize,
    showSiblingGroup, setShowSiblingGroup,
    wireframeMode, setWireframeMode,
    depthColorMode, setDepthColorMode,
    depthFilterMax, setDepthFilterMax,
    soloMode, setSoloMode,
    showResPicker, setShowResPicker,
    resOverride, setResOverride,
    showWorldPos, setShowWorldPos,
    compFilterType, setCompFilterType,
    showLabelText, setShowLabelText,
    showSceneStats, setShowSceneStats,
    showOverlayPanel, setShowOverlayPanel,
    showToolPanel, setShowToolPanel,
    showSizeLabels, setShowSizeLabels,
    showOpacityLabels, setShowOpacityLabels,
    showCompBadges, setShowCompBadges,
    showRotLabels, setShowRotLabels,
    showNameLabels, setShowNameLabels,
    showAnchorOverlay, setShowAnchorOverlay,
    showColorSwatch, setShowColorSwatch,
    showChildCountBadge, setShowChildCountBadge,
    showDepthLabel, setShowDepthLabel,
    showFlipOverlay, setShowFlipOverlay,
    showSelBBox, setShowSelBBox,
    showCompBadge, setShowCompBadge,
    showTagBadge, setShowTagBadge,
    showDupNameOverlay, setShowDupNameOverlay,
    showRotArrow, setShowRotArrow,
    showSizeOverlay, setShowSizeOverlay,
    showOriginCross, setShowOriginCross,
    showScaleLabel, setShowScaleLabel,
    showLayerBadge, setShowLayerBadge,
    showEventBadge, setShowEventBadge,
    showSafeZone, setShowSafeZone,
    showRuleOfThirds, setShowRuleOfThirds,
    showCustomRatio, setShowCustomRatio,
    customRatioW, setCustomRatioW,
    customRatioH, setCustomRatioH,
    showOOBHighlight, setShowOOBHighlight,
    showSceneBBox, setShowSceneBBox,
    showSelOrder, setShowSelOrder,
    showAnchorDot, setShowAnchorDot,
    showSelPolyline, setShowSelPolyline,
    showHierarchyLines, setShowHierarchyLines,
    showSelGroupBBox, setShowSelGroupBBox,
    showParentHighlight, setShowParentHighlight,
    showInactiveDim, setShowInactiveDim,
    showColorViz, setShowColorViz,
    showCrosshair, setShowCrosshair,
    showDepthHeat, setShowDepthHeat,
    showOpacityOverlay, setShowOpacityOverlay,
    showRotOverlay, setShowRotOverlay,
    showPosText, setShowPosText,
    showScaleText, setShowScaleText,
    showCompCountBadge, setShowCompCountBadge,
    showSizeHeat, setShowSizeHeat,
    showSelCenter, setShowSelCenter,
    showPairDist, setShowPairDist,
    showSpriteName, setShowSpriteName,
    showUuidBadge, setShowUuidBadge,
    showCenterDot, setShowCenterDot,
    showNonDefaultAnchor, setShowNonDefaultAnchor,
    showZeroSizeWarn, setShowZeroSizeWarn,
    showSelAxisLine, setShowSelAxisLine,
    showSiblingHighlight, setShowSiblingHighlight,
    showOpacityHud, setShowOpacityHud,
    showRefArrows, setShowRefArrows,
  }
}

export type CCSceneOverlayState = ReturnType<typeof useCCSceneOverlayState>
