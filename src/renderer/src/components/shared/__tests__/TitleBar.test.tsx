import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { TitleBar } from '../TitleBar'

describe('TitleBar', () => {
  const noop = vi.fn()

  // 1. 기본 렌더 — Open Folder 버튼 항상 표시
  it('Open Folder 버튼을 렌더한다', () => {
    render(<TitleBar onOpenFolder={noop} />)
    expect(screen.getByText('Open Folder')).toBeInTheDocument()
  })

  // 2. onOpenFolder 콜백 호출
  it('Open Folder 클릭 시 onOpenFolder가 호출된다', () => {
    const handler = vi.fn()
    render(<TitleBar onOpenFolder={handler} />)
    fireEvent.click(screen.getByText('Open Folder'))
    expect(handler).toHaveBeenCalledOnce()
  })

  // 3. onOpenPalette 없으면 검색 버튼 미표시
  it('onOpenPalette 미제공 시 커맨드 팔레트 버튼이 없다', () => {
    render(<TitleBar onOpenFolder={noop} />)
    expect(screen.queryByText('검색...')).not.toBeInTheDocument()
  })

  // 4. onOpenPalette 제공 시 검색 버튼 표시
  it('onOpenPalette 제공 시 커맨드 팔레트 버튼이 표시된다', () => {
    render(<TitleBar onOpenFolder={noop} onOpenPalette={noop} />)
    expect(screen.getByText('검색...')).toBeInTheDocument()
  })

  // 5. 커맨드 팔레트 버튼 클릭
  it('커맨드 팔레트 버튼 클릭 시 onOpenPalette 호출된다', () => {
    const handler = vi.fn()
    render(<TitleBar onOpenFolder={noop} onOpenPalette={handler} />)
    fireEvent.click(screen.getByText('검색...'))
    expect(handler).toHaveBeenCalledOnce()
  })

  // 6. Ctrl+P 힌트 텍스트 표시
  it('커맨드 팔레트 버튼에 Ctrl+P 힌트가 있다', () => {
    render(<TitleBar onOpenFolder={noop} onOpenPalette={noop} />)
    expect(screen.getByText('Ctrl+P')).toBeInTheDocument()
  })

  // 7. 사이드바 토글 버튼 — 미제공 시 없음
  it('onToggleSidebar 미제공 시 사이드바 버튼이 없다', () => {
    render(<TitleBar onOpenFolder={noop} />)
    expect(screen.queryByTitle(/사이드바/)).not.toBeInTheDocument()
  })

  // 8. 사이드바 토글 버튼 — 제공 시 표시
  it('onToggleSidebar 제공 시 사이드바 버튼이 표시된다', () => {
    render(<TitleBar onOpenFolder={noop} onToggleSidebar={noop} sidebarCollapsed={false} />)
    expect(screen.getByTitle(/사이드바/)).toBeInTheDocument()
  })

  // 9. 사이드바 토글 클릭
  it('사이드바 버튼 클릭 시 onToggleSidebar 호출된다', () => {
    const handler = vi.fn()
    render(<TitleBar onOpenFolder={noop} onToggleSidebar={handler} sidebarCollapsed={false} />)
    fireEvent.click(screen.getByTitle(/사이드바/))
    expect(handler).toHaveBeenCalledOnce()
  })

  // 10. 설정 버튼 — 미제공 시 없음
  it('onOpenSettings 미제공 시 설정 버튼이 없다', () => {
    render(<TitleBar onOpenFolder={noop} />)
    expect(screen.queryByTitle(/설정/)).not.toBeInTheDocument()
  })

  // 11. 설정 버튼 표시
  it('onOpenSettings 제공 시 설정 버튼이 표시된다', () => {
    render(<TitleBar onOpenFolder={noop} onOpenSettings={noop} />)
    expect(screen.getByTitle(/설정/)).toBeInTheDocument()
  })

  // 12. 설정 버튼 클릭
  it('설정 버튼 클릭 시 onOpenSettings 호출된다', () => {
    const handler = vi.fn()
    render(<TitleBar onOpenFolder={noop} onOpenSettings={handler} />)
    fireEvent.click(screen.getByTitle(/설정/))
    expect(handler).toHaveBeenCalledOnce()
  })

  // 13. 테마 토글 버튼 — 미제공 시 없음
  it('onToggleTheme 미제공 시 테마 버튼이 없다', () => {
    render(<TitleBar onOpenFolder={noop} />)
    expect(screen.queryByTitle(/모드/)).not.toBeInTheDocument()
  })

  // 14. 다크모드 시 라이트 전환 버튼 표시
  it('theme=dark 일 때 라이트 모드 전환 버튼을 표시한다', () => {
    render(<TitleBar onOpenFolder={noop} onToggleTheme={noop} theme="dark" />)
    expect(screen.getByTitle('라이트 모드로 전환')).toBeInTheDocument()
  })

  // 15. 라이트모드 시 다크 전환 버튼 표시
  it('theme=light 일 때 다크 모드 전환 버튼을 표시한다', () => {
    render(<TitleBar onOpenFolder={noop} onToggleTheme={noop} theme="light" />)
    expect(screen.getByTitle('다크 모드로 전환')).toBeInTheDocument()
  })

  // 16. 테마 버튼 클릭
  it('테마 버튼 클릭 시 onToggleTheme 호출된다', () => {
    const handler = vi.fn()
    render(<TitleBar onOpenFolder={noop} onToggleTheme={handler} theme="dark" />)
    fireEvent.click(screen.getByTitle('라이트 모드로 전환'))
    expect(handler).toHaveBeenCalledOnce()
  })
})
