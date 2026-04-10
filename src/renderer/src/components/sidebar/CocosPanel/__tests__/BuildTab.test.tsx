import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { BuildTabContent } from '../BuildTab'

// ── window.api mock ─────────────────────────────────────────────────────────────

beforeAll(() => {
  Object.defineProperty(window, 'api', {
    value: { shellExec: vi.fn() },
    writable: true,
    configurable: true,
  })
})

// ── helpers ────────────────────────────────────────────────────────────────────

function makeProjectInfo(overrides: Partial<{ projectPath: string; version: string }> = {}) {
  return {
    projectPath: '/test/MyGame',
    version: '2.4.13',
    detected: true,
    scenes: [],
    ...overrides,
  }
}

// ── tests ──────────────────────────────────────────────────────────────────────

describe('BuildTabContent', () => {
  it('renders platform selector and build button', () => {
    render(<BuildTabContent projectInfo={makeProjectInfo()} />)
    expect(screen.getByText('CC 빌드 트리거')).toBeTruthy()
    expect(screen.getByRole('combobox')).toBeTruthy()
    expect(screen.getByRole('button')).toBeTruthy()
  })

  it('shows project path', () => {
    render(<BuildTabContent projectInfo={makeProjectInfo({ projectPath: '/test/MyGame' })} />)
    expect(screen.getAllByText(/\/test\/MyGame/).length).toBeGreaterThan(0)
  })

  it('shows cc version', () => {
    render(<BuildTabContent projectInfo={makeProjectInfo({ version: '3.6.1' })} />)
    expect(screen.getAllByText(/3\.6\.1/).length).toBeGreaterThan(0)
  })

  it('disables build button when projectPath is absent', () => {
    render(<BuildTabContent projectInfo={makeProjectInfo({ projectPath: undefined as unknown as string })} />)
    const btn = screen.getByRole('button')
    expect(btn).toHaveProperty('disabled', true)
  })

  it('enables build button when projectPath is set', () => {
    render(<BuildTabContent projectInfo={makeProjectInfo()} />)
    const btn = screen.getByRole('button')
    expect(btn).toHaveProperty('disabled', false)
  })

  it('platform change updates output path preview', () => {
    render(<BuildTabContent projectInfo={makeProjectInfo({ projectPath: '/test/MyGame' })} />)
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'web-desktop' } })
    expect(screen.getAllByText(/web-desktop/).length).toBeGreaterThan(0)
  })

  it('shows CC2 CLI preview with --path flag for 2.x version', () => {
    render(<BuildTabContent projectInfo={makeProjectInfo({ version: '2.4.13' })} />)
    const text = document.body.textContent ?? ''
    expect(text).toContain('--path')
  })

  it('shows CC3 CLI preview with --project flag for 3.x version', () => {
    render(<BuildTabContent projectInfo={makeProjectInfo({ version: '3.6.1' })} />)
    const text = document.body.textContent ?? ''
    expect(text).toContain('--project')
  })

  it('calls window.api.shellExec on build button click', async () => {
    const shellExec = vi.fn().mockResolvedValue({ ok: true, output: '' })
    ;(window.api as typeof window.api & { shellExec: typeof shellExec }).shellExec = shellExec

    render(<BuildTabContent projectInfo={makeProjectInfo()} />)
    const btn = screen.getByRole('button')
    fireEvent.click(btn)
    expect(shellExec).toHaveBeenCalledTimes(1)
  })

  it('shows success result after successful build', async () => {
    const shellExec = vi.fn().mockResolvedValue({ ok: true, output: '' })
    ;(window.api as typeof window.api & { shellExec: typeof shellExec }).shellExec = shellExec

    render(<BuildTabContent projectInfo={makeProjectInfo()} />)
    fireEvent.click(screen.getByRole('button'))
    // wait for async state update
    await vi.waitFor(() => {
      expect(screen.getByText(/빌드 시작됨/)).toBeTruthy()
    })
  })

  it('shows error result when shellExec returns error', async () => {
    const shellExec = vi.fn().mockResolvedValue({ ok: false, output: 'build failed' })
    ;(window.api as typeof window.api & { shellExec: typeof shellExec }).shellExec = shellExec

    render(<BuildTabContent projectInfo={makeProjectInfo()} />)
    fireEvent.click(screen.getByRole('button'))
    await vi.waitFor(() => {
      expect(screen.getByText(/build failed/)).toBeTruthy()
    })
  })

  it('shows error result when shellExec throws', async () => {
    const shellExec = vi.fn().mockRejectedValue(new Error('exec error'))
    ;(window.api as typeof window.api & { shellExec: typeof shellExec }).shellExec = shellExec

    render(<BuildTabContent projectInfo={makeProjectInfo()} />)
    fireEvent.click(screen.getByRole('button'))
    await vi.waitFor(() => {
      expect(screen.getByText(/exec error/)).toBeTruthy()
    })
  })

  it('platform select has all 4 options', () => {
    render(<BuildTabContent projectInfo={makeProjectInfo()} />)
    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.options.length).toBe(4)
    const values = Array.from(select.options).map(o => o.value)
    expect(values).toContain('web-mobile')
    expect(values).toContain('web-desktop')
    expect(values).toContain('android')
    expect(values).toContain('ios')
  })
})
