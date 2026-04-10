import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { BackupManager } from '../BackupManager'

// ── window.api mock ─────────────────────────────────────────────────────────────

type BakFile = { name: string; path: string; size: number; mtime: number }

const mockApi = {
  ccFileListBakFiles: vi.fn<[string], Promise<BakFile[]>>(),
  ccFileRestoreFromBak: vi.fn<[string, string], Promise<{ success: boolean }>>(),
  ccFileDeleteAllBakFiles: vi.fn<[string], Promise<void>>(),
}

beforeAll(() => {
  Object.defineProperty(window, 'api', {
    value: mockApi,
    writable: true,
    configurable: true,
  })
})

beforeEach(() => {
  vi.clearAllMocks()
  // Default: empty backup list
  mockApi.ccFileListBakFiles.mockResolvedValue([])
})

// ── helpers ────────────────────────────────────────────────────────────────────

function makeBak(overrides: Partial<BakFile> = {}): BakFile {
  return {
    name: 'Main.bak',
    path: '/proj/scenes/Main.bak',
    size: 1024,
    mtime: new Date('2024-01-15T10:30:00').getTime(),
    ...overrides,
  }
}

// ── tests ──────────────────────────────────────────────────────────────────────

describe('BackupManager', () => {
  it('renders toggle button initially collapsed', () => {
    render(<BackupManager scenePath="/proj/scenes/Main.fire" onRestored={vi.fn()} />)
    expect(screen.getByText(/백업 파일 \(0\)/)).toBeTruthy()
    // Section should be hidden (toggle arrow is ▸)
    expect(screen.getByText(/▸/)).toBeTruthy()
  })

  it('expands backup section on toggle click', async () => {
    mockApi.ccFileListBakFiles.mockResolvedValue([makeBak()])
    render(<BackupManager scenePath="/proj/scenes/Main.fire" onRestored={vi.fn()} />)

    fireEvent.click(screen.getByText(/백업 파일/))
    await waitFor(() => {
      expect(screen.getByText(/▾/)).toBeTruthy()
    })
  })

  it('calls ccFileListBakFiles when expanded', async () => {
    render(<BackupManager scenePath="/proj/scenes/Main.fire" onRestored={vi.fn()} />)
    fireEvent.click(screen.getByText(/백업 파일/))
    await waitFor(() => {
      expect(mockApi.ccFileListBakFiles).toHaveBeenCalledWith('/proj/scenes/Main.fire')
    })
  })

  it('shows empty message when no backup files', async () => {
    mockApi.ccFileListBakFiles.mockResolvedValue([])
    render(<BackupManager scenePath="/proj/scenes/Main.fire" onRestored={vi.fn()} />)
    fireEvent.click(screen.getByText(/백업 파일/))
    await waitFor(() => {
      expect(screen.getByText(/백업 파일이 없습니다/)).toBeTruthy()
    })
  })

  it('shows backup file count in header', async () => {
    const baks = [makeBak({ name: 'a.bak' }), makeBak({ name: 'b.bak', path: '/proj/b.bak' })]
    mockApi.ccFileListBakFiles.mockResolvedValue(baks)
    render(<BackupManager scenePath="/proj/scenes/Main.fire" onRestored={vi.fn()} />)
    fireEvent.click(screen.getByText(/백업 파일/))
    await waitFor(() => {
      expect(screen.getByText(/백업 파일 \(2\)/)).toBeTruthy()
    })
  })

  it('renders restore button for each backup', async () => {
    const baks = [
      makeBak({ name: 'a.bak' }),
      makeBak({ name: 'b.bak', path: '/proj/b.bak' }),
    ]
    mockApi.ccFileListBakFiles.mockResolvedValue(baks)
    render(<BackupManager scenePath="/proj/scenes/Main.fire" onRestored={vi.fn()} />)
    fireEvent.click(screen.getByText(/백업 파일/))
    await waitFor(() => {
      expect(screen.getAllByText('복원').length).toBe(2)
    })
  })

  it('calls ccFileRestoreFromBak and onRestored on restore click', async () => {
    mockApi.ccFileListBakFiles.mockResolvedValue([makeBak()])
    mockApi.ccFileRestoreFromBak.mockResolvedValue({ success: true })
    const onRestored = vi.fn()

    render(<BackupManager scenePath="/proj/scenes/Main.fire" onRestored={onRestored} />)
    fireEvent.click(screen.getByText(/백업 파일/))
    await waitFor(() => screen.getByText('복원'))

    fireEvent.click(screen.getByText('복원'))
    await waitFor(() => {
      expect(mockApi.ccFileRestoreFromBak).toHaveBeenCalledWith('/proj/scenes/Main.bak', '/proj/scenes/Main.fire')
      expect(onRestored).toHaveBeenCalledTimes(1)
    })
  })

  it('does not call onRestored when restore fails', async () => {
    mockApi.ccFileListBakFiles.mockResolvedValue([makeBak()])
    mockApi.ccFileRestoreFromBak.mockResolvedValue({ success: false })
    const onRestored = vi.fn()

    render(<BackupManager scenePath="/proj/scenes/Main.fire" onRestored={onRestored} />)
    fireEvent.click(screen.getByText(/백업 파일/))
    await waitFor(() => screen.getByText('복원'))

    fireEvent.click(screen.getByText('복원'))
    await waitFor(() => {
      expect(mockApi.ccFileRestoreFromBak).toHaveBeenCalledTimes(1)
      expect(onRestored).not.toHaveBeenCalled()
    })
  })

  it('shows delete all button when backups exist', async () => {
    mockApi.ccFileListBakFiles.mockResolvedValue([makeBak()])
    render(<BackupManager scenePath="/proj/scenes/Main.fire" onRestored={vi.fn()} />)
    fireEvent.click(screen.getByText(/백업 파일/))
    await waitFor(() => {
      expect(screen.getByText('모두 삭제')).toBeTruthy()
    })
  })

  it('shows confirmation buttons on delete all click', async () => {
    mockApi.ccFileListBakFiles.mockResolvedValue([makeBak()])
    render(<BackupManager scenePath="/proj/scenes/Main.fire" onRestored={vi.fn()} />)
    fireEvent.click(screen.getByText(/백업 파일/))
    await waitFor(() => screen.getByText('모두 삭제'))

    fireEvent.click(screen.getByText('모두 삭제'))
    expect(screen.getByText('확인')).toBeTruthy()
    expect(screen.getByText('취소')).toBeTruthy()
  })

  it('calls ccFileDeleteAllBakFiles on confirm delete', async () => {
    mockApi.ccFileListBakFiles.mockResolvedValue([makeBak()])
    mockApi.ccFileDeleteAllBakFiles.mockResolvedValue(undefined)

    render(<BackupManager scenePath="/proj/scenes/Main.fire" onRestored={vi.fn()} />)
    fireEvent.click(screen.getByText(/백업 파일/))
    await waitFor(() => screen.getByText('모두 삭제'))

    fireEvent.click(screen.getByText('모두 삭제'))
    fireEvent.click(screen.getByText('확인'))

    await waitFor(() => {
      expect(mockApi.ccFileDeleteAllBakFiles).toHaveBeenCalledWith('/proj/scenes/Main.fire')
    })
  })

  it('cancels delete confirmation on cancel click', async () => {
    mockApi.ccFileListBakFiles.mockResolvedValue([makeBak()])

    render(<BackupManager scenePath="/proj/scenes/Main.fire" onRestored={vi.fn()} />)
    fireEvent.click(screen.getByText(/백업 파일/))
    await waitFor(() => screen.getByText('모두 삭제'))

    fireEvent.click(screen.getByText('모두 삭제'))
    fireEvent.click(screen.getByText('취소'))

    expect(screen.getByText('모두 삭제')).toBeTruthy()
    expect(screen.queryByText('확인')).toBeNull()
  })

  it('shows max backup selector when expanded', async () => {
    render(<BackupManager scenePath="/proj/scenes/Main.fire" onRestored={vi.fn()} />)
    fireEvent.click(screen.getByText(/백업 파일/))
    await waitFor(() => {
      expect(screen.getByText('max')).toBeTruthy()
    })
  })

  it('renders backup file size and date', async () => {
    mockApi.ccFileListBakFiles.mockResolvedValue([
      makeBak({ size: 2048, mtime: new Date('2024-06-01T14:30:00').getTime() }),
    ])
    render(<BackupManager scenePath="/proj/scenes/Main.fire" onRestored={vi.fn()} />)
    fireEvent.click(screen.getByText(/백업 파일/))
    await waitFor(() => {
      // size: 2048 / 1024 = 2.0KB
      expect(screen.getByText(/2\.0KB/)).toBeTruthy()
    })
  })
})
