import { useState, useEffect, useCallback } from 'react'

/**
 * R1376: CC 파일 씬 컨텍스트 — 채팅에 주입할 씬/노드 정보
 * CocosPanel에서 localStorage에 기록 → ChatPanel에서 읽어 extraSystemPrompt에 포함
 */

const CTX_KEY = 'cc-file-scene-context'
const INJECT_KEY = 'cc-ctx-inject'

export interface CCFileContextData {
  sceneName: string
  version: string
  selectedNodeName?: string
  selectedNodeUuid?: string
  components?: string[]
  /** R1477: 마지막 저장 시 씬 변경 diff 요약 */
  lastSaveDiff?: string
}

export function useCCFileContext() {
  const [enabled, setEnabled] = useState(() => {
    return localStorage.getItem(INJECT_KEY) !== 'false'
  })
  const [contextString, setContextString] = useState('')

  const refresh = useCallback(() => {
    if (!enabled) { setContextString(''); return }
    try {
      const raw = localStorage.getItem(CTX_KEY)
      if (!raw) { setContextString(''); return }
      const data: CCFileContextData = JSON.parse(raw)
      const lines = [
        '[CC 씬 컨텍스트]',
        `씬: ${data.sceneName} (${data.version})`,
      ]
      if (data.selectedNodeName) {
        lines.push(`선택 노드: ${data.selectedNodeName} (uuid: ${data.selectedNodeUuid ?? '?'})`)
      }
      if (data.components && data.components.length > 0) {
        lines.push(`컴포넌트: ${data.components.join(', ')}`)
      }
      // R1477: 마지막 씬 변경 diff
      if (data.lastSaveDiff) {
        lines.push(`마지막 변경: ${data.lastSaveDiff}`)
      }
      setContextString(lines.join('\n'))
    } catch {
      setContextString('')
    }
  }, [enabled])

  useEffect(() => {
    refresh()
    // Listen for custom event from CocosPanel
    const handler = () => refresh()
    window.addEventListener('cc-file-context-update', handler)
    return () => window.removeEventListener('cc-file-context-update', handler)
  }, [refresh])

  const toggle = useCallback(() => {
    setEnabled(prev => {
      const next = !prev
      localStorage.setItem(INJECT_KEY, String(next))
      if (!next) setContextString('')
      return next
    })
  }, [])

  return { enabled, toggle, contextString }
}

/**
 * CocosPanel에서 호출: 현재 씬/노드 정보를 localStorage에 기록
 */
export function updateCCFileContext(data: CCFileContextData | null) {
  if (data) {
    localStorage.setItem(CTX_KEY, JSON.stringify(data))
  } else {
    localStorage.removeItem(CTX_KEY)
  }
  window.dispatchEvent(new Event('cc-file-context-update'))
}
