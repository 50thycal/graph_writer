/**
 * A crash on this canvas used to blank the page, which tells the user nothing and
 * tells us less. Everything that escapes React — a throw inside a debounced save,
 * a rejected IndexedDB write — is collected here so the UI can show what happened.
 */

export interface StudioError {
  id: string;
  message: string;
  detail?: string;
  at: string;
}

type Listener = (errors: StudioError[]) => void;

const listeners = new Set<Listener>();
let errors: StudioError[] = [];
let installed = false;

export function describeError(value: unknown): { message: string; detail?: string } {
  if (value instanceof Error) {
    return { message: value.message || value.name, detail: value.stack };
  }
  if (typeof value === "string") return { message: value };
  try {
    return { message: JSON.stringify(value) };
  } catch {
    return { message: String(value) };
  }
}

/**
 * This app makes no network requests of its own: documents live in IndexedDB and the
 * bundle is static. A failed fetch or an undecodable image therefore comes from the
 * canvas SDK loading its own fonts or watermark, which is cosmetic and not worth
 * alarming anyone about. Everything else is reported.
 */
const BENIGN = /failed to fetch|cannot be decoded|network error|load failed/i;

export function isBenign(message: string) {
  return BENIGN.test(message);
}

export function reportError(value: unknown, context?: string) {
  const { message, detail } = describeError(value);
  const labelled = context ? `${context}: ${message}` : message;
  // A repeating failure (an autosave that throws on every keystroke) should not
  // stack up; keep the newest occurrence and its count instead.
  const existing = errors.find((error) => error.message === labelled);
  const next: StudioError = {
    id: existing?.id ?? `${Date.now()}-${errors.length}`,
    message: labelled,
    detail,
    at: new Date().toISOString(),
  };
  errors = [...errors.filter((error) => error.message !== labelled), next].slice(-4);
  for (const listener of listeners) listener(errors);
  return next;
}

export function dismissErrors() {
  errors = [];
  for (const listener of listeners) listener(errors);
}

export function subscribeToErrors(listener: Listener) {
  listeners.add(listener);
  listener(errors);
  return () => listeners.delete(listener);
}

export function currentErrors() {
  return errors;
}

/** Route uncaught errors and rejected promises into the same log. */
export function installGlobalErrorReporting(target: Window = window) {
  if (installed) return () => undefined;
  installed = true;
  // Errors the app attributes itself always report; these are the unattributed ones,
  // so canvas asset noise is dropped here rather than shown as an app failure.
  const onError = (event: ErrorEvent) => {
    const raised = event.error ?? event.message;
    if (!isBenign(describeError(raised).message)) reportError(raised);
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    if (!isBenign(describeError(event.reason).message)) reportError(event.reason, "Unhandled promise");
  };
  target.addEventListener("error", onError);
  target.addEventListener("unhandledrejection", onRejection);
  return () => {
    target.removeEventListener("error", onError);
    target.removeEventListener("unhandledrejection", onRejection);
    installed = false;
  };
}
