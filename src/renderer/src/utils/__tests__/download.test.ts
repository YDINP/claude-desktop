import { describe, it, expect, vi, beforeEach } from 'vitest'
import { downloadFile } from '../download'

describe('downloadFile', () => {
  const clickMock = vi.fn()
  const createObjectURLMock = vi.fn(() => 'blob:mock-url')
  const revokeObjectURLMock = vi.fn()
  const createElementMock = vi.fn()

  beforeEach(() => {
    clickMock.mockClear()
    createObjectURLMock.mockClear()
    revokeObjectURLMock.mockClear()
    createElementMock.mockClear()

    vi.stubGlobal('URL', {
      createObjectURL: createObjectURLMock,
      revokeObjectURL: revokeObjectURLMock,
    })

    const fakeAnchor = {
      href: '',
      download: '',
      click: clickMock,
    }
    createElementMock.mockReturnValue(fakeAnchor)
    vi.spyOn(document, 'createElement').mockImplementation(createElementMock)
  })

  it('Blob을 생성하고 URL을 anchor에 할당한 후 click을 호출한다', () => {
    downloadFile('content', 'file.md')

    expect(createObjectURLMock).toHaveBeenCalledOnce()
    const blob: Blob = createObjectURLMock.mock.calls[0][0]
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('text/markdown')

    expect(createElementMock).toHaveBeenCalledWith('a')
    expect(clickMock).toHaveBeenCalledOnce()
  })

  it('anchor의 href와 download 속성이 올바르게 설정된다', () => {
    const fakeAnchor = { href: '', download: '', click: clickMock }
    createElementMock.mockReturnValue(fakeAnchor)

    downloadFile('hello', 'output.md')

    expect(fakeAnchor.href).toBe('blob:mock-url')
    expect(fakeAnchor.download).toBe('output.md')
  })

  it('click 후 URL.revokeObjectURL이 호출된다', () => {
    downloadFile('data', 'test.md')

    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:mock-url')
  })

  it('mimeType 인자가 Blob 타입에 반영된다', () => {
    downloadFile('data', 'data.json', 'application/json')

    const blob: Blob = createObjectURLMock.mock.calls[0][0]
    expect(blob.type).toBe('application/json')
  })

  it('content 문자열이 Blob에 포함된다', async () => {
    // URL.createObjectURL을 bypass하고 Blob 직접 검증
    const capturedBlobs: Blob[] = []
    createObjectURLMock.mockImplementation((b: Blob) => {
      capturedBlobs.push(b)
      return 'blob:url'
    })

    downloadFile('hello world', 'file.txt', 'text/plain')

    const text = await capturedBlobs[0].text()
    expect(text).toBe('hello world')
  })
})
