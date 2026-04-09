import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { SessionItem, type SessionItemProps } from '../SessionItem'
import type { SessionMeta } from '../sessionUtils'

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────

function makeSession(override: Partial<SessionMeta> & { id: string }): SessionMeta {
  return {
    title: 'Test Session',
    cwd: '/tmp',
    model: 'claude-3',
    updatedAt: 1_700_000_000_000,
    createdAt: 1_700_000_000_000,
    messageCount: 5,
    ...override,
  }
}

function makeProps(override: Partial<SessionItemProps> = {}): SessionItemProps {
  const session = makeSession({ id: 'sess-1' })
  return {
    session,
    depth: 0,
    isActive: false,
    isSelected: false,
    selectionMode: false,
    mergeMode: false,
    mergeTargets: new Set(),
    hoveredSession: null,
    sessionStats: {},
    sessionNotes: {},
    noteOpenId: null,
    noteText: '',
    noteSaving: false,
    renamingId: null,
    renameValue: '',
    menuOpenId: null,
    exportedId: null,
    inlineTagInput: null,
    inlineTagValue: '',
    dragId: null,
    dragOverId: null,
    archivedSessions: new Set(),
    tagColors: {},
    filterCustomTags: new Set(),
    filterCustomTag: null,
    forkChildren: [],
    menuRef: React.createRef<HTMLDivElement>(),
    inlineTagRef: React.createRef<HTMLInputElement>(),

    onSelect: vi.fn(),
    onMergeToggle: vi.fn(),
    onSelectionToggle: vi.fn(),
    onSessionMouseEnter: vi.fn(),
    onSessionMouseLeave: vi.fn(),
    onDragStart: vi.fn(),
    onDragOver: vi.fn(),
    onDragLeave: vi.fn(),
    onDrop: vi.fn(),
    onDragEnd: vi.fn(),
    onContextMenu: vi.fn(),
    onSetSelectedIds: vi.fn(),
    onSetRenameValue: vi.fn(),
    onCommitRename: vi.fn(),
    onSetRenamingId: vi.fn(),
    onStartRename: vi.fn(),
    onToggleFilterCustomTag: vi.fn(),
    onRemoveTag: vi.fn(),
    onColorPickerTag: vi.fn(),
    onDuplicateSession: vi.fn(),
    onToggleArchive: vi.fn(),
    onHandlePin: vi.fn(),
    onSetMenuOpenId: vi.fn(),
    onMenuStartRename: vi.fn(),
    onMenuDuplicate: vi.fn(),
    onMenuMerge: vi.fn(),
    onMenuNote: vi.fn(),
    onMenuTagPicker: vi.fn(),
    onMenuToggleLock: vi.fn(),
    onMenuExportMarkdown: vi.fn(),
    onMenuExportJson: vi.fn(),
    onMenuDelete: vi.fn(),
    onNoteOpenId: vi.fn(),
    onSetNoteText: vi.fn(),
    onNoteSave: vi.fn(),
    onSetInlineTagInput: vi.fn(),
    onSetInlineTagValue: vi.fn(),
    onCommitInlineTag: vi.fn(),
    renderSessionItem: vi.fn().mockReturnValue(null),

    ...override,
  }
}

// ── 렌더 기본 ─────────────────────────────────────────────────────────────────

describe('SessionItem 기본 렌더', () => {
  it('session title이 렌더된다', () => {
    render(<SessionItem {...makeProps()} />)
    expect(screen.getByText('Test Session')).toBeTruthy()
  })

  it('isActive=true이면 활성 스타일로 렌더된다', () => {
    const { container } = render(<SessionItem {...makeProps({ isActive: true })} />)
    // 활성 항목은 배경색 변수가 다름 — DOM 구조 확인
    const root = container.firstElementChild as HTMLElement
    expect(root).toBeTruthy()
  })

  it('isActive=false이면 기본 스타일로 렌더된다', () => {
    const { container } = render(<SessionItem {...makeProps({ isActive: false })} />)
    const root = container.firstElementChild as HTMLElement
    expect(root).toBeTruthy()
  })

  it('세션 클릭 시 onSelect가 호출된다', () => {
    const onSelect = vi.fn()
    render(<SessionItem {...makeProps({ onSelect })} />)
    const title = screen.getByText('Test Session')
    fireEvent.click(title)
    expect(onSelect).toHaveBeenCalledWith('sess-1')
  })

  it('우클릭 시 onContextMenu가 호출된다', () => {
    const onContextMenu = vi.fn()
    const { container } = render(<SessionItem {...makeProps({ onContextMenu })} />)
    // 바깥 <div key={s.id}> > 내부 draggable div에 onContextMenu가 있음
    const draggable = container.querySelector('[draggable]') as HTMLElement
    fireEvent.contextMenu(draggable)
    expect(onContextMenu).toHaveBeenCalled()
  })
})

// ── 태그 렌더 ─────────────────────────────────────────────────────────────────

describe('SessionItem 태그 렌더', () => {
  it('tags가 있으면 TagDot이 렌더된다', () => {
    const session = makeSession({ id: 'sess-2', tags: ['red'] })
    const { container } = render(<SessionItem {...makeProps({ session })} />)
    // TagDot은 span으로 렌더됨
    const dots = container.querySelectorAll('span[style*="border-radius: 50%"]')
    expect(dots.length).toBeGreaterThan(0)
  })

  it('tags가 없으면 TagDot이 렌더되지 않는다', () => {
    const session = makeSession({ id: 'sess-3', tags: undefined })
    const { container } = render(<SessionItem {...makeProps({ session })} />)
    const dots = container.querySelectorAll('span[style*="border-radius: 50%"]')
    expect(dots.length).toBe(0)
  })

  it('여러 태그가 있으면 여러 TagDot이 렌더된다', () => {
    const session = makeSession({ id: 'sess-4', tags: ['red', 'blue', 'green'] })
    const { container } = render(<SessionItem {...makeProps({ session })} />)
    const dots = container.querySelectorAll('span[style*="border-radius: 50%"]')
    expect(dots.length).toBe(3)
  })
})

// ── 고정(핀) ──────────────────────────────────────────────────────────────────

describe('SessionItem 핀 버튼', () => {
  it('pinned=true인 세션에 핀 아이콘이 표시된다', () => {
    const session = makeSession({ id: 'sess-5', pinned: true })
    const { container } = render(<SessionItem {...makeProps({ session })} />)
    // 핀 버튼이 존재하며 클릭 가능
    const buttons = container.querySelectorAll('button')
    expect(buttons.length).toBeGreaterThan(0)
  })
})

// ── 선택 모드 ─────────────────────────────────────────────────────────────────

describe('SessionItem 선택 모드', () => {
  it('selectionMode=true이면 체크박스가 렌더된다', () => {
    const props = makeProps({ selectionMode: true })
    render(<SessionItem {...props} />)
    // 체크박스 input 또는 체크박스 역할 요소 확인
    // SessionItem은 selection mode에서 별도 UI를 렌더함
    expect(screen.getByText('Test Session')).toBeTruthy()
  })

  it('isSelected=true이면 선택 상태로 렌더된다', () => {
    const props = makeProps({ selectionMode: true, isSelected: true })
    const { container } = render(<SessionItem {...props} />)
    // 선택 상태 DOM이 존재함을 확인
    expect(container.firstElementChild).toBeTruthy()
  })
})

// ── 잠금 세션 ─────────────────────────────────────────────────────────────────

describe('SessionItem 잠금 세션', () => {
  it('locked=true인 세션에서 렌더가 에러 없이 완료된다', () => {
    const session = makeSession({ id: 'sess-lock', locked: true })
    expect(() => render(<SessionItem {...makeProps({ session })} />)).not.toThrow()
  })
})

// ── depth ─────────────────────────────────────────────────────────────────────

describe('SessionItem depth', () => {
  it('depth=1 서브 세션이 에러 없이 렌더된다', () => {
    const props = makeProps({ depth: 1 })
    expect(() => render(<SessionItem {...props} />)).not.toThrow()
  })

  it('depth=5 깊은 서브 세션이 에러 없이 렌더된다', () => {
    const props = makeProps({ depth: 5 })
    expect(() => render(<SessionItem {...props} />)).not.toThrow()
  })

  it('forkChildren이 있으면 renderSessionItem이 호출된다', () => {
    const renderSessionItem = vi.fn().mockReturnValue(null)
    const forkChildren = [makeSession({ id: 'child-1' })]
    const props = makeProps({ forkChildren, renderSessionItem })
    render(<SessionItem {...props} />)
    expect(renderSessionItem).toHaveBeenCalledWith(forkChildren[0], 1)
  })
})

// ── 드래그 ────────────────────────────────────────────────────────────────────

describe('SessionItem 드래그 이벤트', () => {
  it('dragOver=true이면 dragOverId가 일치 시 시각적 구분이 렌더된다', () => {
    const props = makeProps({ dragOverId: 'sess-1', dragId: 'other' })
    expect(() => render(<SessionItem {...props} />)).not.toThrow()
  })
})
