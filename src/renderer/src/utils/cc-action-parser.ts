export interface CCAction {
  type: 'moveNode' | 'setProperty' | 'buildWeb' | 'refreshTree' | 'createNode' | 'deleteNode' | 'setActive'
  uuid?: string
  x?: number
  y?: number
  key?: string
  value?: unknown
  parentUuid?: string
  nodeName?: string
  active?: boolean
}

const ALLOWED_TYPES = ['moveNode', 'setProperty', 'buildWeb', 'refreshTree', 'createNode', 'deleteNode', 'setActive']

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
        if (item.type && ALLOWED_TYPES.includes(item.type)) {
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
export async function executeCCActions(actions: CCAction[], port = 9090): Promise<string[]> {
  const results: string[] = []
  for (const action of actions) {
    try {
      switch (action.type) {
        case 'moveNode':
          if (action.uuid != null && action.x != null && action.y != null) {
            await window.api.ccMoveNode?.(port, action.uuid, action.x, action.y)
            results.push(`✓ ${action.uuid} → (${action.x}, ${action.y})`)
          }
          break
        case 'setProperty':
          if (action.uuid != null && action.key != null) {
            await window.api.ccSetProperty?.(port, action.uuid, action.key, action.value)
            results.push(`✓ ${action.uuid}.${action.key} = ${JSON.stringify(action.value)}`)
          }
          break
        case 'setActive':
          if (action.uuid != null && action.active !== undefined) {
            await window.api.ccSetProperty?.(port, action.uuid, 'active', action.active)
            results.push(`✓ setActive: ${action.uuid} → ${action.active}`)
          }
          break
        case 'createNode':
          if (window.api.ccCreateNode) {
            await window.api.ccCreateNode(port, action.parentUuid ?? '', action.nodeName ?? 'NewNode')
            results.push(`✓ createNode: ${action.nodeName ?? 'NewNode'}`)
          }
          break
        case 'deleteNode':
          if (action.uuid != null && window.api.ccDeleteNode) {
            await window.api.ccDeleteNode(port, action.uuid)
            results.push(`✓ deleteNode: ${action.uuid}`)
          }
          break
        case 'buildWeb':
          results.push('buildWeb: 미구현 (수동 빌드 필요)')
          break
        case 'refreshTree':
          await window.api.ccGetTree?.(port)
          results.push('↺ 씬 트리 새로고침 완료')
          break
      }
    } catch (e) {
      results.push(`✗ ${action.type}: ${e}`)
    }
  }
  return results
}
