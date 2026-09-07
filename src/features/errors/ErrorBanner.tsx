import { useEffect, useState } from "react";
import { dismissErrors, subscribeToErrors, type StudioError } from "./error-log";

/** Non-fatal failures that escaped React: a save that threw, a rejected write. */
export function ErrorBanner() {
  const [errors, setErrors] = useState<StudioError[]>([]);
  useEffect(() => {
    const unsubscribe = subscribeToErrors(setErrors);
    return () => { unsubscribe(); };
  }, []);
  if (!errors.length) return null;
  return <div className="error-banner" role="alert">
    <div>
      <strong>{errors.length === 1 ? "Something went wrong" : `${errors.length} problems`}</strong>
      {errors.map((error) => <span key={error.id}>{error.message}</span>)}
    </div>
    <button type="button" className="icon-button" aria-label="Dismiss error report" onClick={dismissErrors}>×</button>
  </div>;
}
