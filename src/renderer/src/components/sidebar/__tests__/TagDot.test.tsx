import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'
import { TagDot } from '../TagDot'
import { TAG_CSS, TAG_COLORS } from '../sessionUtils'

// jsdom은 hex를 rgb()로 정규화하므로 헬퍼로 변환
function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgb(${r}, ${g}, ${b})`
}

describe('TagDot', () => {
  it('span 요소가 렌더된다', () => {
    const { container } = render(<TagDot color="red" />)
    const span = container.querySelector('span')
    expect(span).toBeTruthy()
  })

  it('기본 size는 8이다', () => {
    const { container } = render(<TagDot color="blue" />)
    const span = container.querySelector('span') as HTMLElement
    expect(span.style.width).toBe('8px')
    expect(span.style.height).toBe('8px')
  })

  it('size prop으로 크기를 지정할 수 있다', () => {
    const { container } = render(<TagDot color="green" size={12} />)
    const span = container.querySelector('span') as HTMLElement
    expect(span.style.width).toBe('12px')
    expect(span.style.height).toBe('12px')
  })

  it('red 색상이 TAG_CSS.red에 대응하는 rgb로 렌더된다', () => {
    const { container } = render(<TagDot color="red" />)
    const span = container.querySelector('span') as HTMLElement
    expect(span.style.background).toBe(hexToRgb(TAG_CSS.red))
  })

  it('orange 색상이 TAG_CSS.orange에 대응하는 rgb로 렌더된다', () => {
    const { container } = render(<TagDot color="orange" />)
    const span = container.querySelector('span') as HTMLElement
    expect(span.style.background).toBe(hexToRgb(TAG_CSS.orange))
  })

  it('blue 색상이 TAG_CSS.blue에 대응하는 rgb로 렌더된다', () => {
    const { container } = render(<TagDot color="blue" />)
    const span = container.querySelector('span') as HTMLElement
    expect(span.style.background).toBe(hexToRgb(TAG_CSS.blue))
  })

  it('green 색상이 TAG_CSS.green에 대응하는 rgb로 렌더된다', () => {
    const { container } = render(<TagDot color="green" />)
    const span = container.querySelector('span') as HTMLElement
    expect(span.style.background).toBe(hexToRgb(TAG_CSS.green))
  })

  it('yellow 색상이 TAG_CSS.yellow에 대응하는 rgb로 렌더된다', () => {
    const { container } = render(<TagDot color="yellow" />)
    const span = container.querySelector('span') as HTMLElement
    expect(span.style.background).toBe(hexToRgb(TAG_CSS.yellow))
  })

  it('purple 색상이 TAG_CSS.purple에 대응하는 rgb로 렌더된다', () => {
    const { container } = render(<TagDot color="purple" />)
    const span = container.querySelector('span') as HTMLElement
    expect(span.style.background).toBe(hexToRgb(TAG_CSS.purple))
  })

  it('TAG_COLORS 모든 색상이 에러 없이 렌더된다', () => {
    for (const color of TAG_COLORS) {
      expect(() => render(<TagDot color={color} />)).not.toThrow()
    }
  })

  it('borderRadius가 50%로 원형이다', () => {
    const { container } = render(<TagDot color="purple" />)
    const span = container.querySelector('span') as HTMLElement
    expect(span.style.borderRadius).toBe('50%')
  })

  it('flexShrink가 0이다', () => {
    const { container } = render(<TagDot color="yellow" />)
    const span = container.querySelector('span') as HTMLElement
    expect(span.style.flexShrink).toBe('0')
  })

  it('display가 inline-block이다', () => {
    const { container } = render(<TagDot color="green" />)
    const span = container.querySelector('span') as HTMLElement
    expect(span.style.display).toBe('inline-block')
  })

  it('size=20 큰 도트도 정상 렌더된다', () => {
    const { container } = render(<TagDot color="blue" size={20} />)
    const span = container.querySelector('span') as HTMLElement
    expect(span.style.width).toBe('20px')
    expect(span.style.height).toBe('20px')
  })
})
