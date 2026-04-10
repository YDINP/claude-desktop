import { useEffect, useRef, useState, useCallback, useMemo, useTransition } from 'react'
import type { ChatMessage } from '../domains/chat/domain'

interface UseChatSearchOptions {
  messages: ChatMessage[]
  searchTrigger?: number
  setShowOnlyBookmarks: React.Dispatch<React.SetStateAction<boolean>>
  setChatViewMode: React.Dispatch<React.SetStateAction<'compact' | 'wide'>>
  onScrollToMatch: (idx: number) => void
}

interface UseChatSearchReturn {
  showSearch: boolean
  setShowSearch: React.Dispatch<React.SetStateAction<boolean>>
  showShortcutsOverlay: boolean
  setShowShortcutsOverlay: React.Dispatch<React.SetStateAction<boolean>>
  searchQuery: string
  matchCount: number
  safeMatchIdx: number
  matchedMessageIds: Set<string>
  currentMatchId: string | null
  isSearchPending: boolean
  searchInputRef: React.RefObject<HTMLInputElement>
  handleSearchChange: (value: string) => void
  handleSearchPrev: () => void
  handleSearchNext: () => void
  handleSearchKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
}

export function useChatSearch({
  messages,
  searchTrigger,
  setShowOnlyBookmarks,
  setChatViewMode,
  onScrollToMatch,
}: UseChatSearchOptions): UseChatSearchReturn {
  const [showSearch, setShowSearch] = useState(false)
  const [showShortcutsOverlay, setShowShortcutsOverlay] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [matchIdx, setMatchIdx] = useState(0)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [isSearchPending, startSearchTransition] = useTransition()

  // searchTrigger prop 변화 시 검색창 열기 (App.tsx에서 Ctrl+F 시 증가)
  useEffect(() => {
    if (searchTrigger === undefined || searchTrigger === 0) return
    setShowSearch(true)
    setTimeout(() => searchInputRef.current?.focus(), 50)
  }, [searchTrigger])

  // 채팅 패널 키보드 단축키
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable

      if (e.key === 'Escape') {
        if (showShortcutsOverlay) { setShowShortcutsOverlay(false); return }
        if (showSearch) { setShowSearch(false); return }
      }

      if (isInput) return

      if (e.key === '?') {
        setShowShortcutsOverlay(v => !v)
        return
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'f' || e.key === 'F') {
          e.preventDefault()
          setShowSearch(v => !v)
        } else if (e.key === 'b' || e.key === 'B') {
          e.preventDefault()
          setShowOnlyBookmarks(v => !v)
        } else if (e.key === 'w' || e.key === 'W') {
          e.preventDefault()
          setChatViewMode(v => v === 'compact' ? 'wide' : 'compact')
        }
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [showSearch, showShortcutsOverlay, setShowOnlyBookmarks, setChatViewMode])

  // 검색창 열릴 때 input focus
  useEffect(() => {
    if (showSearch) {
      setTimeout(() => searchInputRef.current?.focus(), 50)
    } else {
      setSearchQuery('')
      setMatchIdx(0)
    }
  }, [showSearch])

  // 매치된 메시지 인덱스 목록
  const matchedIndices = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.toLowerCase()
    const indices: number[] = []
    messages.forEach((m, i) => {
      if (m.text.toLowerCase().includes(q)) indices.push(i)
    })
    return indices
  }, [searchQuery, messages.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const matchCount = matchedIndices.length
  const safeMatchIdx = matchCount > 0 ? Math.min(matchIdx, matchCount - 1) : 0

  const matchedMessageIds = useMemo(
    () => new Set(matchedIndices.map(i => messages[i]?.id ?? '')),
    [matchedIndices] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const currentMatchId = matchCount > 0 ? (messages[matchedIndices[safeMatchIdx]]?.id ?? null) : null

  // 매치 이동 시 가상 스크롤 점프
  useEffect(() => {
    if (matchCount > 0 && matchedIndices[safeMatchIdx] !== undefined) {
      onScrollToMatch(matchedIndices[safeMatchIdx])
    }
  }, [safeMatchIdx, matchedIndices, matchCount]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearchChange = useCallback((value: string) => {
    startSearchTransition(() => {
      setSearchQuery(value)
      setMatchIdx(0)
    })
  }, [])

  const handleSearchPrev = useCallback(() => {
    setMatchIdx(i => (i - 1 + matchCount) % matchCount)
  }, [matchCount])

  const handleSearchNext = useCallback(() => {
    setMatchIdx(i => (i + 1) % matchCount)
  }, [matchCount])

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.shiftKey ? handleSearchPrev() : handleSearchNext()
    } else if (e.key === 'Escape') {
      setShowSearch(false)
    }
  }, [handleSearchPrev, handleSearchNext])

  return {
    showSearch,
    setShowSearch,
    showShortcutsOverlay,
    setShowShortcutsOverlay,
    searchQuery,
    matchCount,
    safeMatchIdx,
    matchedMessageIds,
    currentMatchId,
    isSearchPending,
    searchInputRef,
    handleSearchChange,
    handleSearchPrev,
    handleSearchNext,
    handleSearchKeyDown,
  }
}
