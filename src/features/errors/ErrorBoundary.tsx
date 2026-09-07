import { Component, type ErrorInfo, type ReactNode } from "react";
import { describeError, reportError } from "./error-log";

interface Props {
  children: ReactNode;
}

interface State {
  message: string | null;
  detail?: string;
}

/**
 * Without this, one bad render blanks the page and the only recovery a user has is
 * a refresh with no idea what broke. Projects live in IndexedDB, so returning to the
 * dashboard is always safe.
 */
export class StudioErrorBoundary extends Component<Props, State> {
  state: State = { message: null };

  static getDerivedStateFromError(error: unknown): State {
    return describeError(error);
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    reportError(error, "Interface");
    this.setState((current) => ({ ...current, detail: `${current.detail ?? ""}\n${info.componentStack ?? ""}`.trim() }));
  }

  render() {
    if (this.state.message === null) return this.props.children;
    return <main className="crash-screen" role="alert">
      <div>
        <p className="eyebrow">Something broke</p>
        <h1>The canvas stopped responding</h1>
        <p className="crash-explanation">Your projects are saved on this device and were not lost. Go back to the project list, or reload to try this canvas again.</p>
        <pre className="crash-message">{this.state.message}</pre>
        <div className="crash-actions">
          <button type="button" className="button primary" onClick={() => {
            window.location.hash = "";
            window.location.reload();
          }}>Back to projects</button>
          <button type="button" className="button secondary" onClick={() => window.location.reload()}>Reload this canvas</button>
        </div>
        {this.state.detail ? <details className="crash-detail"><summary>Technical detail</summary><pre>{this.state.detail}</pre></details> : null}
      </div>
    </main>;
  }
}
