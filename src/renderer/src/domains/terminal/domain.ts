/**
 * Terminal 도메인 순수 타입
 * 외부 의존 없음
 */

export interface TerminalTab {
  id: string
  title: string
  cwd: string
}

export interface TerminalOutput {
  tabId: string
  data: string
  timestamp: number
}
