import React from "react";

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: unknown): State {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error("React ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
            textAlign: "center",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <img src="/icon-192.png" alt="Chainsaw Courses" style={{ width: 64, marginBottom: "1.5rem" }} />
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#e27226", marginBottom: "0.75rem" }}>
            Something went wrong
          </h1>
          <p style={{ color: "#555", maxWidth: 320, lineHeight: 1.6, marginBottom: "1.5rem" }}>
            {this.state.message}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "0.75rem 2rem",
              background: "#e27226",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontSize: "1rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reload app
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
