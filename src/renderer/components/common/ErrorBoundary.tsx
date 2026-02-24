import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: React.ReactNode
  fallbackMessage?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-rose-500/10">
            <AlertTriangle className="h-6 w-6 text-rose-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-slate-200">{this.props.fallbackMessage || 'Something went wrong'}</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">{this.state.error?.message}</p>
          </div>
          <button
            onClick={this.handleReset}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-white/[0.06] border border-white/[0.08] text-slate-300 hover:bg-white/[0.1] transition-all"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try Again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
