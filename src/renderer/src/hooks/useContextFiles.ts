import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY_PREFIX = 'context-files-'  // + cwd hash for per-project isolation

export interface ContextFile {
  path: string
  name: string
  content: string
  tokens: number   // approx: Math.ceil(content.length / 3.5)
  error?: string
}

function storageKey(cwd: string | null): string {
  if (!cwd) return `${STORAGE_KEY_PREFIX}global`
  // simple hash: last 2 path segments joined
  const parts = cwd.replace(/\\/g, '/').split('/').filter(Boolean)
  return `${STORAGE_KEY_PREFIX}${parts.slice(-2).join('-')}`
}

function loadPaths(cwd: string | null): string[] {
  try {
    return JSON.parse(localStorage.getItem(storageKey(cwd)) ?? '[]') as string[]
  } catch {
    return []
  }
}

function savePaths(cwd: string | null, paths: string[]): void {
  try {
    localStorage.setItem(storageKey(cwd), JSON.stringify(paths))
  } catch { /* ignore */ }
}

export function useContextFiles(cwd: string | null) {
  const [files, setFiles] = useState<ContextFile[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Load saved paths and fetch their content when cwd changes
  useEffect(() => {
    const paths = loadPaths(cwd)
    if (paths.length === 0) {
      setFiles([])
      return
    }
    setIsLoading(true)
    Promise.all(
      paths.map(async (path): Promise<ContextFile> => {
        const name = path.replace(/\\/g, '/').split('/').pop() ?? path
        try {
          const content = await window.api.readFile(path)
          return { path, name, content, tokens: Math.ceil(content.length / 3.5) }
        } catch (e) {
          return { path, name, content: '', tokens: 0, error: String(e) }
        }
      })
    ).then(loaded => {
      setFiles(loaded)
      setIsLoading(false)
    })
  }, [cwd])

  const addFile = useCallback(async (path: string) => {
    const name = path.replace(/\\/g, '/').split('/').pop() ?? path
    if (files.some(f => f.path === path)) return  // already added
    try {
      const content = await window.api.readFile(path)
      const newFile: ContextFile = { path, name, content, tokens: Math.ceil(content.length / 3.5) }
      setFiles(prev => {
        const next = [...prev, newFile]
        savePaths(cwd, next.map(f => f.path))
        return next
      })
    } catch (e) {
      const newFile: ContextFile = { path, name, content: '', tokens: 0, error: String(e) }
      setFiles(prev => {
        const next = [...prev, newFile]
        savePaths(cwd, next.map(f => f.path))
        return next
      })
    }
  }, [cwd, files])

  const removeFile = useCallback((path: string) => {
    setFiles(prev => {
      const next = prev.filter(f => f.path !== path)
      savePaths(cwd, next.map(f => f.path))
      return next
    })
  }, [cwd])

  const contextString = files.length === 0 ? undefined : [
    '# 첨부된 컨텍스트 파일',
    ...files
      .filter(f => f.content && !f.error)
      .map(f => `## ${f.name}\n\`\`\`\n${f.content.slice(0, 8000)}\n\`\`\``),
  ].join('\n\n')

  const totalTokens = files.reduce((s, f) => s + f.tokens, 0)

  return { files, isLoading, addFile, removeFile, contextString, totalTokens }
}
