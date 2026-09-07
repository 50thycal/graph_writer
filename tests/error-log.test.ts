import { beforeEach, describe, expect, it } from "vitest";
import { currentErrors, describeError, dismissErrors, installGlobalErrorReporting, isBenign, reportError, subscribeToErrors, type StudioError } from "../src/features/errors/error-log";

describe("error log", () => {
  beforeEach(() => dismissErrors());

  it("describes errors, strings and objects", () => {
    expect(describeError(new Error("boom")).message).toBe("boom");
    expect(describeError(new Error("boom")).detail).toContain("boom");
    expect(describeError("plain").message).toBe("plain");
    expect(describeError({ code: 7 }).message).toBe('{"code":7}');
  });

  it("labels with context and notifies subscribers", () => {
    const seen: StudioError[][] = [];
    const unsubscribe = subscribeToErrors((errors) => seen.push(errors));
    reportError(new Error("quota"), "Could not save this project");
    expect(seen.at(-1)?.[0].message).toBe("Could not save this project: quota");
    unsubscribe();
    reportError(new Error("ignored"));
    expect(seen.at(-1)?.length).toBe(1);
  });

  it("collapses a repeating failure and caps the log", () => {
    for (let attempt = 0; attempt < 5; attempt += 1) reportError(new Error("same"), "Autosave");
    expect(currentErrors()).toHaveLength(1);
    for (let index = 0; index < 6; index += 1) reportError(new Error(`distinct ${index}`));
    expect(currentErrors()).toHaveLength(4);
    expect(currentErrors().at(-1)?.message).toBe("distinct 5");
    dismissErrors();
    expect(currentErrors()).toHaveLength(0);
  });

  it("classifies canvas asset noise as benign", () => {
    expect(isBenign("Failed to fetch")).toBe(true);
    expect(isBenign("The source image cannot be decoded.")).toBe(true);
    expect(isBenign("Duplicate element ID: agent-1")).toBe(false);
  });

  it("captures uncaught errors and rejected promises once installed", () => {
    const handlers: Record<string, (event: unknown) => void> = {};
    const target = {
      addEventListener: (name: string, handler: (event: unknown) => void) => { handlers[name] = handler; },
      removeEventListener: (name: string) => { delete handlers[name]; },
    } as unknown as Window;
    const uninstall = installGlobalErrorReporting(target);
    handlers.error?.({ error: new Error("render blew up") });
    handlers.unhandledrejection?.({ reason: new Error("storage rejected") });
    handlers.error?.({ error: new Error("Failed to fetch") });
    handlers.unhandledrejection?.({ reason: new Error("The source image cannot be decoded.") });
    // Attributed failures still report even when they mention the network.
    reportError(new Error("Failed to fetch"), "Could not save this project");
    expect(currentErrors().map((error) => error.message)).toEqual([
      "render blew up",
      "Unhandled promise: storage rejected",
      "Could not save this project: Failed to fetch",
    ]);
    uninstall();
    expect(handlers.error).toBeUndefined();
  });
});
