import React, { useState, useEffect, useRef } from 'react'

export interface ResizeHandlers {
  // Terminal
  terminalOpen: boolean
  setTerminalOpen: React.Dispatch<React.SetStateAction<boolean>>
  bottomHeight: number
  isDragging: boolean
  handleSplitterMouseDown: (e: React.MouseEvent) => void

  // Sidebar
  sidebarCollapsed: boolean
  setSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>
  sidebarWidth: number
  setSidebarWidth: React.Dispatch<React.SetStateAction<number>>
  isSidebarDragging: boolean
  handleSidebarDragMouseDown: (e: React.MouseEvent) => void

  // AgentBay
  agentBayWidth: number
  setAgentBayWidth: React.Dispatch<React.SetStateAction<number>>
  isAgentBayDragging: boolean
  setIsAgentBayDragging: React.Dispatch<React.SetStateAction<boolean>>
  agentBayDragStartX: React.MutableRefObject<number>
  agentBayDragStartW: React.MutableRefObject<number>
}

export function useResizeHandlers(): ResizeHandlers {
  // ── Terminal ──
  const [terminalOpen, setTerminalOpen] = useState(false)
  const [bottomHeight, setBottomHeight] = useState(240)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartY = useRef(0)
  const dragStartH = useRef(0)

  // ── Sidebar resize & collapse ──
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem('sidebar-collapsed') === 'true'
  )
  const [sidebarWidth, setSidebarWidth] = useState(
    () => Number(localStorage.getItem('sidebar-width')) || 220
  )
  useEffect(() => { localStorage.setItem('sidebar-collapsed', String(sidebarCollapsed)) }, [sidebarCollapsed])
  useEffect(() => { localStorage.setItem('sidebar-width', String(sidebarWidth)) }, [sidebarWidth])
  const [isSidebarDragging, setIsSidebarDragging] = useState(false)
  const sidebarDragStartX = useRef(0)
  const sidebarDragStartW = useRef(0)

  // ── HQ mode / AgentBay ──
  const [agentBayWidth, setAgentBayWidth] = useState(260)
  const [isAgentBayDragging, setIsAgentBayDragging] = useState(false)
  const agentBayDragStartX = useRef(0)
  const agentBayDragStartW = useRef(0)

  // ── Sidebar drag ──
  const handleSidebarDragMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsSidebarDragging(true)
    sidebarDragStartX.current = e.clientX
    sidebarDragStartW.current = sidebarWidth
  }
  useEffect(() => {
    if (!isSidebarDragging) return
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
    const onMove = (e: MouseEvent) => {
      const delta = e.clientX - sidebarDragStartX.current
      setSidebarWidth(Math.max(160, Math.min(500, sidebarDragStartW.current + delta)))
    }
    const onUp = () => {
      setIsSidebarDragging(false)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
  }, [isSidebarDragging])

  // ── AgentBay resize drag ──
  useEffect(() => {
    if (!isAgentBayDragging) return
    const onMove = (e: MouseEvent) => {
      const delta = e.clientX - agentBayDragStartX.current
      setAgentBayWidth(Math.max(180, Math.min(480, agentBayDragStartW.current + delta)))
    }
    const onUp = () => setIsAgentBayDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [isAgentBayDragging])

  // ── Splitter drag ──
  const handleSplitterMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    dragStartY.current = e.clientY
    dragStartH.current = bottomHeight
  }
  useEffect(() => {
    if (!isDragging) return
    const onMove = (e: MouseEvent) => {
      const delta = dragStartY.current - e.clientY
      setBottomHeight(Math.max(80, Math.min(600, dragStartH.current + delta)))
    }
    const onUp = () => setIsDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [isDragging])

  return {
    // Terminal
    terminalOpen,
    setTerminalOpen,
    bottomHeight,
    isDragging,
    handleSplitterMouseDown,
    // Sidebar
    sidebarCollapsed,
    setSidebarCollapsed,
    sidebarWidth,
    setSidebarWidth,
    isSidebarDragging,
    handleSidebarDragMouseDown,
    // AgentBay
    agentBayWidth,
    setAgentBayWidth,
    isAgentBayDragging,
    setIsAgentBayDragging,
    agentBayDragStartX,
    agentBayDragStartW,
  }
}
