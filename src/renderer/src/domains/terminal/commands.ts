/**
 * Terminal CommandBus 핸들러 (도메인 레벨)
 *
 * terminal:create/write/resize/close — 이미 ipcBridge에서 IPC 호출 등록됨.
 * 여기서는 IPC 호출 이후 store 동기화가 필요한 로직을 제공한다.
 *
 * ipcBridge 핸들러를 덮어쓰지 않고, 도메인 레벨 함수로 export한다.
 * 컴포넌트에서는 이 함수를 호출하여 store까지 일관되게 업데이트할 수 있다.
 */
import { commandBus } from '../../kernel/commandBus'
import { useTerminalStore } from './store'
import type { TerminalTab } from './domain'

/**
 * 터미널 탭 생성 + IPC + store 업데이트
 * commandBus.dispatch 대신 직접 호출용 고수준 API
 */
export async function createTerminalTab(id: string, cwd: string, title?: string): Promise<void> {
  const tab: TerminalTab = { id, title: title ?? 'cmd', cwd }
  useTerminalStore.getState().addTab(tab)

  await commandBus.dispatch({
    type: 'terminal:create',
    payload: { id, cwd },
  })
}

/**
 * 터미널 탭 닫기 + IPC + store 업데이트
 */
export async function closeTerminalTab(id: string): Promise<void> {
  await commandBus.dispatch({
    type: 'terminal:close',
    payload: { id },
  })

  useTerminalStore.getState().removeTab(id)
}

/**
 * Terminal 도메인 커맨드 등록 (현재는 예약)
 * ipcBridge가 이미 terminal:* 커맨드를 등록하므로 중복 등록하지 않음.
 */
export function registerTerminalCommands(): void {
  // 현재 추가 등록할 커맨드 없음.
  // ipcBridge가 terminal:create/write/resize/close를 처리함.
  // 고수준 API(createTerminalTab, closeTerminalTab)는 위에서 export.
}
