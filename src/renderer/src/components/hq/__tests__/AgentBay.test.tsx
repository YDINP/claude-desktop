import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { AgentBay } from '../AgentBay'

interface SessionMeta {
  id: string
  title?: string
  model?: string
  updatedAt: number
  inputTokens?: number
  outputTokens?: number
}

function makeSession(override: Partial<SessionMeta> & { id: string }): SessionMeta {
  return {
    title: 'Test Session',
    model: 'claude-3',
    updatedAt: Date.now() - 60000,
    inputTokens: 100,
    outputTokens: 50,
    ...override,
  }
}

const defaultProps = {
  activeSessionId: null,
  onSelectSession: vi.fn(),
  onNewSession: vi.fn(),
}

describe('AgentBay', () => {
  it('AGENT BAY 헤더가 표시된다', () => {
    render(<AgentBay {...defaultProps} />)
    expect(screen.getByText('AGENT BAY')).toBeTruthy()
  })

  it('세션 수가 헤더에 표시된다', () => {
    const sessions = [makeSession({ id: 's1' }), makeSession({ id: 's2' })]
    render(<AgentBay {...defaultProps} sessions={sessions} />)
    expect(screen.getByText(/● 2/)).toBeTruthy()
  })

  it('세션+에이전트 합산 수 표시', () => {
    const sessions = [makeSession({ id: 's1' })]
    const agents = [{ id: 'a1', description: 'agent1', status: 'running' as const, startTime: Date.now() }]
    render(<AgentBay {...defaultProps} sessions={sessions} agents={agents} />)
    expect(screen.getByText(/● 2/)).toBeTruthy()
  })

  it('세션/에이전트 없고 스트리밍 없으면 NO ACTIVE AGENTS 표시', () => {
    render(<AgentBay {...defaultProps} />)
    expect(screen.getByText('NO ACTIVE AGENTS')).toBeTruthy()
  })

  it('세션 카드 클릭 시 onSelectSession 호출', () => {
    const onSelect = vi.fn()
    const sessions = [makeSession({ id: 'click-sess', title: 'My Session' })]
    render(<AgentBay {...defaultProps} sessions={sessions} onSelectSession={onSelect} />)
    const card = screen.getByText('My Session')
    fireEvent.click(card)
    expect(onSelect).toHaveBeenCalledWith('click-sess')
  })

  it('isStreaming=true이면 MAIN 카드가 표시된다', () => {
    const sessions = [makeSession({ id: 's1' })]
    render(<AgentBay {...defaultProps} sessions={sessions} isStreaming={true} activeSessionId="s1" />)
    expect(screen.getByText('MAIN')).toBeTruthy()
  })

  it('STREAMING 상태 표시 (tool 없을 때)', () => {
    const sessions = [makeSession({ id: 's1' })]
    render(<AgentBay {...defaultProps} sessions={sessions} isStreaming={true} activeSessionId="s1" />)
    expect(screen.getByText('STREAMING')).toBeTruthy()
  })

  it('running tool 있으면 TOOL 상태 표시', () => {
    const sessions = [makeSession({ id: 's1' })]
    const toolUses = [{ id: 't1', name: 'Bash', input: {}, status: 'running' as const, result: null }]
    render(<AgentBay {...defaultProps} sessions={sessions} isStreaming={true} activeSessionId="s1" toolUses={toolUses} />)
    expect(screen.getByText('TOOL')).toBeTruthy()
  })

  it('running 에이전트 카드가 RUNNING 표시', () => {
    const agents = [{ id: 'a1', description: 'Running Agent', status: 'running' as const, startTime: Date.now() }]
    render(<AgentBay {...defaultProps} agents={agents} />)
    expect(screen.getByText('RUNNING')).toBeTruthy()
  })

  it('completed 에이전트 카드가 DONE 표시', () => {
    const agents = [{ id: 'a2', description: 'Done Agent', status: 'completed' as const, startTime: Date.now() - 5000 }]
    render(<AgentBay {...defaultProps} agents={agents} />)
    expect(screen.getByText('DONE')).toBeTruthy()
  })

  it('error 에이전트 카드가 ERROR 표시', () => {
    const agents = [{ id: 'a3', description: 'Error Agent', status: 'error' as const, startTime: Date.now() - 2000 }]
    render(<AgentBay {...defaultProps} agents={agents} />)
    expect(screen.getByText('ERROR')).toBeTruthy()
  })

  it('세션 타이틀 없으면 AGENT-XXX 형식 표시', () => {
    const sessions = [makeSession({ id: 'abc123', title: undefined })]
    render(<AgentBay {...defaultProps} sessions={sessions} />)
    expect(screen.getByText('AGENT-123')).toBeTruthy()
  })

  it('토큰 > 1000이면 k 단위로 표시', () => {
    const sessions = [makeSession({ id: 's1', inputTokens: 1500, outputTokens: 500 })]
    render(<AgentBay {...defaultProps} sessions={sessions} />)
    expect(screen.getByText(/2\.0k tok/)).toBeTruthy()
  })

  it('에이전트 output이 있으면 표시', () => {
    const agents = [{
      id: 'a1',
      description: 'Test Agent',
      status: 'completed' as const,
      startTime: Date.now() - 3000,
      output: 'done result',
    }]
    render(<AgentBay {...defaultProps} agents={agents} />)
    expect(screen.getByText(/done result/)).toBeTruthy()
  })
})
