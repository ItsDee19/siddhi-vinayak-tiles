import { Component } from 'react'

// Local ErrorBoundary that surfaces the actual error in the UI so runtime
// issues are visible without needing to open DevTools. Renders a friendly
// "Something went wrong" panel with the error message + stack (dev only).
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    const e = this.state.error
    return (
      <div className="m-4 rounded-card border border-terracotta/50 bg-charcoal-700 p-6 shadow-card">
        <h3 className="font-display text-xl text-cream">Something went wrong</h3>
        <p className="mt-2 text-sm text-sand/80">
          {e?.name}: {e?.message || 'Unknown error'}
        </p>
        {import.meta.env.DEV && e?.stack && (
          <pre className="mt-4 max-h-64 overflow-auto rounded bg-charcoal-800 p-3 text-[10px] text-sand/60">
            {e.stack}
          </pre>
        )}
        <button
          onClick={() => this.setState({ error: null })}
          className="btn-outline mt-4 px-4 py-2 text-xs"
        >
          Try again
        </button>
      </div>
    )
  }
}
