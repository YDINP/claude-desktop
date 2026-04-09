import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { ProjectProvider, useProject } from '../project-store'
import { createElement } from 'react'

// window.api mock
const mockApi = {
  getCurrentProject: vi.fn().mockResolvedValue(null),
  getRecentProjects: vi.fn().mockResolvedValue([]),
  openFolder: vi.fn().mockResolvedValue(null),
  setProject: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(window, 'api', { value: mockApi, writable: true, configurable: true })
})

function wrapper({ children }: { children: React.ReactNode }) {
  return createElement(ProjectProvider, null, children)
}

describe('useProject', () => {
  it('window.api 없으면 에러 없이 기본값 반환', async () => {
    Object.defineProperty(window, 'api', { value: undefined, writable: true, configurable: true })
    const { result } = renderHook(() => useProject(), { wrapper })
    expect(result.current.currentPath).toBeNull()
    expect(result.current.recentPaths).toEqual([])
    expect(result.current.selectedModel).toBe('claude-opus-4-6')
    expect(result.current.totalCost).toBe(0)
  })

  it('초기 로드 시 api.getCurrentProject/getRecentProjects 호출', async () => {
    mockApi.getCurrentProject.mockResolvedValue('/my/project')
    mockApi.getRecentProjects.mockResolvedValue(['/my/project', '/other/project'])

    const { result } = renderHook(() => useProject(), { wrapper })

    await act(async () => {})
    expect(result.current.currentPath).toBe('/my/project')
    expect(result.current.recentPaths).toEqual(['/my/project', '/other/project'])
  })

  it('setModel: selectedModel 변경', async () => {
    const { result } = renderHook(() => useProject(), { wrapper })
    await act(async () => {})
    act(() => { result.current.setModel('claude-haiku-3') })
    expect(result.current.selectedModel).toBe('claude-haiku-3')
  })

  it('addCost: 비용/토큰 누적', async () => {
    const { result } = renderHook(() => useProject(), { wrapper })
    await act(async () => {})

    act(() => { result.current.addCost(0.01, 100, 50) })
    expect(result.current.totalCost).toBeCloseTo(0.01)
    expect(result.current.totalInputTokens).toBe(100)
    expect(result.current.totalOutputTokens).toBe(50)

    act(() => { result.current.addCost(0.02, 200, 100) })
    expect(result.current.totalCost).toBeCloseTo(0.03)
    expect(result.current.totalInputTokens).toBe(300)
    expect(result.current.totalOutputTokens).toBe(150)
  })

  it('addCost: 토큰 기본값 0', async () => {
    const { result } = renderHook(() => useProject(), { wrapper })
    await act(async () => {})
    act(() => { result.current.addCost(0.005) })
    expect(result.current.totalInputTokens).toBe(0)
    expect(result.current.totalOutputTokens).toBe(0)
  })

  it('setProject: currentPath 변경 및 api.setProject 호출', async () => {
    const { result } = renderHook(() => useProject(), { wrapper })
    await act(async () => {})

    act(() => { result.current.setProject('/new/path') })
    expect(result.current.currentPath).toBe('/new/path')
    expect(mockApi.setProject).toHaveBeenCalledWith('/new/path')
    expect(result.current.recentPaths[0]).toBe('/new/path')
  })

  it('setProject: 중복 경로 dedup + 최신을 맨 앞으로', async () => {
    mockApi.getRecentProjects.mockResolvedValue(['/a', '/b'])
    const { result } = renderHook(() => useProject(), { wrapper })
    await act(async () => {})

    act(() => { result.current.setProject('/a') })
    expect(result.current.recentPaths).toEqual(['/a', '/b'])
  })

  it('setProject: 최대 20개 유지', async () => {
    const many = Array.from({ length: 20 }, (_, i) => `/path/${i}`)
    mockApi.getRecentProjects.mockResolvedValue(many)
    const { result } = renderHook(() => useProject(), { wrapper })
    await act(async () => {})

    act(() => { result.current.setProject('/new') })
    expect(result.current.recentPaths.length).toBe(20)
    expect(result.current.recentPaths[0]).toBe('/new')
  })

  it('openFolder: 경로 선택 시 currentPath 업데이트', async () => {
    mockApi.openFolder.mockResolvedValue('/chosen/folder')
    const { result } = renderHook(() => useProject(), { wrapper })
    await act(async () => {})

    await act(async () => { await result.current.openFolder() })
    expect(result.current.currentPath).toBe('/chosen/folder')
    expect(result.current.recentPaths[0]).toBe('/chosen/folder')
  })

  it('openFolder: 취소(null 반환) 시 currentPath 변경 없음', async () => {
    // getCurrentProject=null로 시작
    mockApi.getCurrentProject.mockResolvedValue(null)
    mockApi.openFolder.mockResolvedValue(null)
    const { result } = renderHook(() => useProject(), { wrapper })
    await act(async () => {})
    expect(result.current.currentPath).toBeNull()

    await act(async () => { await result.current.openFolder() })
    expect(result.current.currentPath).toBeNull()
  })

  it('useProject: Provider 없으면 에러', () => {
    expect(() => {
      renderHook(() => useProject())
    }).toThrow('useProject must be used within ProjectProvider')
  })
})
