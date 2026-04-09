import '@testing-library/jest-dom'

// ResizeObserver mock (jsdom에 미구현)
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
