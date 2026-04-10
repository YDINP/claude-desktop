import React from 'react'

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  name?: string
}

interface ErrorBoundaryState {
  error: Error | null
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error(`[${this.props.name ?? 'ErrorBoundary'}]`, error, info)
  }

  render(): React.ReactNode {
    if (this.state.error) {
      return this.props.fallback ?? (
        <div style={{ padding: 16, color: 'var(--error)' }}>
          <p>오류가 발생했습니다.</p>
          <button onClick={() => this.setState({ error: null })}>다시 시도</button>
        </div>
      )
    }
    return this.props.children
  }
}
