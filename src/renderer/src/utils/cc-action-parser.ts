export interface CCAction {
  type: 'moveNode' | 'setProperty' | 'buildWeb' | 'refreshTree'
  uuid?: string
  x?: number
  y?: number
  key?: string
  value?: unknown
}

/**
 * Claude 응답 텍스트에서 ```cc-action ... ``` 블록 파싱
 */
export function parseCCActions(text: string): CCAction[] {
  const actions: CCAction[] = []
  const regex = /```cc-action\n([\s\S]*?)```/g
  let match
  while ((match = regex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim())
      const list = Array.isArray(parsed) ? parsed : [parsed]
      for (const item of list) {
        if (item.type && ['moveNode', 'setProperty', 'buildWeb', 'refreshTree'].includes(item.type)) {
          actions.push(item as CCAction)
        }
      }
    } catch {}
  }
  return actions
}

/**
 * CC 액션 실행
 */
export async function executeCCActions(actions: CCAction[]): Promise<string[]> {
  const results: string[] = []
  for (const action of actions) {
    try {
      switch (action.type) {
        case 'moveNode':
          if (action.uuid != null && action.x != null && action.y != null) {
            await window.api.ccMoveNode?.(action.uuid, action.x, action.y)
            results.push(`✓ ${action.uuid} → (${action.x}, ${action.y})`)
          }
          break
        case 'setProperty':
          if (action.uuid != null && action.key != null) {
            await window.api.ccSetProperty?.(action.uuid, action.key, action.value)
            results.push(`✓ ${action.uuid}.${action.key} = ${JSON.stringify(action.value)}`)
          }
          break
        case 'buildWeb':
          results.push('웹빌드 트리거 (미구현)')
          break
        case 'refreshTree':
          await window.api.ccGetTree?.()
          results.push('↺ 씬 트리 새로고침 완료')
          break
      }
    } catch (e) {
      results.push(`✗ ${action.type}: ${e}`)
    }
  }
  return results
}
