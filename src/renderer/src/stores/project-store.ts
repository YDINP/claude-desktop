import { useState, useEffect, createContext, useContext, ReactNode, createElement } from 'react'

interface ProjectState {
  currentPath: string | null
  recentPaths: string[]
  selectedModel: string
  totalCost: number
  totalInputTokens: number
  totalOutputTokens: number
}

interface ProjectContextType extends ProjectState {
  openFolder: () => Promise<void>
  setProject: (path: string) => void
  setModel: (model: string) => void
  addCost: (cost: number, inputTokens?: number, outputTokens?: number) => void
}

const ProjectContext = createContext<ProjectContextType | null>(null)

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ProjectState>({
    currentPath: null,
    recentPaths: [],
    selectedModel: 'claude-opus-4-6',
    totalCost: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
  })

  useEffect(() => {
    if (!window.api) return
    Promise.all([
      window.api.getCurrentProject(),
      window.api.getRecentProjects(),
    ]).then(([current, recent]) => {
      setState((s) => ({ ...s, currentPath: current, recentPaths: recent }))
    })
  }, [])

  const openFolder = async () => {
    const path = await window.api.openFolder()
    if (path) {
      setState((s) => ({
        ...s,
        currentPath: path,
        recentPaths: [path, ...s.recentPaths.filter((p) => p !== path)].slice(0, 20),
      }))
    }
  }

  const setProject = (path: string) => {
    window.api.setProject(path)
    setState((s) => ({
      ...s,
      currentPath: path,
      recentPaths: [path, ...s.recentPaths.filter((p) => p !== path)].slice(0, 20),
    }))
  }

  const setModel = (model: string) => setState((s) => ({ ...s, selectedModel: model }))
  const addCost = (cost: number, inputTokens = 0, outputTokens = 0) => setState((s) => ({
    ...s,
    totalCost: s.totalCost + cost,
    totalInputTokens: s.totalInputTokens + inputTokens,
    totalOutputTokens: s.totalOutputTokens + outputTokens,
  }))

  return createElement(ProjectContext.Provider, {
    value: { ...state, openFolder, setProject, setModel, addCost },
    children
  })
}

export function useProject() {
  const ctx = useContext(ProjectContext)
  if (!ctx) throw new Error('useProject must be used within ProjectProvider')
  return ctx
}
