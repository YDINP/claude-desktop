import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  ExportConversationButton,
  ExportHtmlButton,
  ExportPdfButton,
  CopyConversationButton,
} from '../ExportButtons'
import type { ChatMessage } from '../../../domains/chat/domain'

Object.assign(navigator, {
  clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
})

vi.mock('../../../utils/i18n', () => ({
  t: (key: string, fallback?: string) => fallback ?? key,
}))

function mockApi(overrides: Record<string, unknown> = {}) {
  Object.defineProperty(window, 'api', {
    value: {
      saveFile: vi.fn().mockResolvedValue(undefined),
      showSaveDialog: vi.fn().mockResolvedValue('/tmp/chat.html'),
      exportHtml: vi.fn().mockResolvedValue(undefined),
      sessionExportPdf: vi.fn().mockResolvedValue(undefined),
      ...overrides,
    },
    writable: true,
    configurable: true,
  })
}

function makeMsg(id: string, role: 'user' | 'assistant', text: string, timestamp = Date.now()): ChatMessage {
  return { id, role, text, toolUses: [], timestamp }
}

const MESSAGES: ChatMessage[] = [
  makeMsg('m1', 'user', '안녕하세요', 1700000000000),
  makeMsg('m2', 'assistant', '안녕하세요! 무엇을 도와드릴까요?', 1700000001000),
]

describe('ExportConversationButton', () => {
  beforeEach(() => {
    mockApi()
    vi.clearAllMocks()
  })

  // 1. 빈 messages이면 렌더 안 함
  it('messages가 비어있으면 버튼이 렌더되지 않는다', () => {
    const { container } = render(<ExportConversationButton messages={[]} />)
    expect(container.firstChild).toBeNull()
  })

  // 2. 버튼 표시
  it('messages가 있으면 내보내기 버튼이 표시된다', () => {
    render(<ExportConversationButton messages={MESSAGES} />)
    expect(screen.getByText(/내보내기/)).toBeInTheDocument()
  })

  // 3. 클릭 시 saveFile 호출
  it('버튼 클릭 시 api.saveFile이 호출된다', async () => {
    render(<ExportConversationButton messages={MESSAGES} />)
    fireEvent.click(screen.getByText(/내보내기/))
    await waitFor(() => expect(window.api.saveFile).toHaveBeenCalled())
  })

  // 4. Markdown 형식으로 저장
  it('내보내기 내용에 역할 헤더가 포함된다', async () => {
    render(<ExportConversationButton messages={MESSAGES} />)
    fireEvent.click(screen.getByText(/내보내기/))
    await waitFor(() => {
      const call = (window.api.saveFile as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(call[0]).toContain('## You')
      expect(call[0]).toContain('## Claude')
    })
  })
})

describe('ExportHtmlButton', () => {
  beforeEach(() => {
    mockApi()
    vi.clearAllMocks()
  })

  // 5. 빈 messages이면 렌더 안 함
  it('messages가 비어있으면 HTML 버튼이 렌더되지 않는다', () => {
    const { container } = render(<ExportHtmlButton messages={[]} />)
    expect(container.firstChild).toBeNull()
  })

  // 6. 버튼 표시
  it('messages가 있으면 HTML 버튼이 표시된다', () => {
    render(<ExportHtmlButton messages={MESSAGES} />)
    expect(screen.getByText(/HTML/)).toBeInTheDocument()
  })

  // 7. 클릭 시 showSaveDialog 호출
  it('버튼 클릭 시 showSaveDialog가 호출된다', async () => {
    render(<ExportHtmlButton messages={MESSAGES} sessionName="test" />)
    fireEvent.click(screen.getByText(/HTML/))
    await waitFor(() => expect(window.api.showSaveDialog).toHaveBeenCalled())
  })

  // 8. showSaveDialog 취소 시 exportHtml 미호출
  it('showSaveDialog가 null 반환 시 exportHtml이 호출되지 않는다', async () => {
    mockApi({ showSaveDialog: vi.fn().mockResolvedValue(null) })
    render(<ExportHtmlButton messages={MESSAGES} />)
    fireEvent.click(screen.getByText(/HTML/))
    await waitFor(() => expect(window.api.showSaveDialog).toHaveBeenCalled())
    expect(window.api.exportHtml).not.toHaveBeenCalled()
  })

  // 9. exportHtml 호출 확인
  it('showSaveDialog 반환값이 있으면 exportHtml이 호출된다', async () => {
    render(<ExportHtmlButton messages={MESSAGES} sessionName="test" />)
    fireEvent.click(screen.getByText(/HTML/))
    await waitFor(() => expect(window.api.exportHtml).toHaveBeenCalledWith('/tmp/chat.html', expect.stringContaining('<!DOCTYPE html>')))
  })
})

describe('ExportPdfButton', () => {
  beforeEach(() => {
    mockApi()
    vi.clearAllMocks()
  })

  // 10. 빈 messages이면 렌더 안 함
  it('messages가 비어있으면 PDF 버튼이 렌더되지 않는다', () => {
    const { container } = render(<ExportPdfButton messages={[]} sessionId="s1" />)
    expect(container.firstChild).toBeNull()
  })

  // 11. sessionId null이면 렌더 안 함
  it('sessionId가 null이면 PDF 버튼이 렌더되지 않는다', () => {
    const { container } = render(<ExportPdfButton messages={MESSAGES} sessionId={null} />)
    expect(container.firstChild).toBeNull()
  })

  // 12. 버튼 표시
  it('messages와 sessionId가 있으면 PDF 버튼이 표시된다', () => {
    render(<ExportPdfButton messages={MESSAGES} sessionId="s1" />)
    expect(screen.getByText(/PDF/)).toBeInTheDocument()
  })

  // 13. 클릭 시 sessionExportPdf 호출
  it('버튼 클릭 시 sessionExportPdf가 호출된다', async () => {
    render(<ExportPdfButton messages={MESSAGES} sessionId="s1" />)
    fireEvent.click(screen.getByText(/PDF/))
    await waitFor(() => expect(window.api.sessionExportPdf).toHaveBeenCalledWith('s1'))
  })
})

describe('CopyConversationButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // 14. 빈 messages이면 렌더 안 함
  it('messages가 비어있으면 복사 버튼이 렌더되지 않는다', () => {
    const { container } = render(<CopyConversationButton messages={[]} />)
    expect(container.firstChild).toBeNull()
  })

  // 15. 버튼 클릭 시 clipboard.writeText 호출
  it('버튼 클릭 시 clipboard.writeText가 호출된다', () => {
    render(<CopyConversationButton messages={MESSAGES} />)
    fireEvent.click(screen.getByText(/대화 복사/))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('**You**')
    )
  })

  // 16. 복사 후 텍스트 변경
  it('복사 후 버튼 텍스트가 복사됨으로 바뀐다', async () => {
    render(<CopyConversationButton messages={MESSAGES} />)
    fireEvent.click(screen.getByText(/대화 복사/))
    await waitFor(() => expect(screen.getByText(/복사됨/)).toBeInTheDocument())
  })
})
