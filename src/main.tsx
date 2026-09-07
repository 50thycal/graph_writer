import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "tldraw/tldraw.css";
import "./styles.css";
import { App } from "./App";
import { StudioErrorBoundary } from "./features/errors/ErrorBoundary";
import { installGlobalErrorReporting } from "./features/errors/error-log";

installGlobalErrorReporting();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <StudioErrorBoundary>
      <App />
    </StudioErrorBoundary>
  </StrictMode>,
);
