"use client"

import { Component, type ErrorInfo, type ReactNode } from "react"

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-900/50 border border-red-700 rounded-md text-white">
          <h2 className="text-lg font-bold mb-2">Something went wrong</h2>
          <p className="text-sm opacity-80">{this.state.error?.message || "An unexpected error occurred"}</p>
        </div>
      )
    }

    return this.props.children
  }
}

