import { describe, expect, it } from "vitest";
import { z } from "zod";
import { formatStudioImportError } from "../src/features/import/import-errors";

describe("StudioDocument import errors", () => {
  it("explains malformed JSON", () => {
    let error: unknown;
    try { JSON.parse("{"); } catch (caught) { error = caught; }
    expect(formatStudioImportError(error)).toMatch(/^Invalid JSON:/);
  });

  it("includes precise validation paths", () => {
    const result = z.object({ elements: z.array(z.object({ id: z.string() })) }).safeParse({ elements: [{ id: 2 }] });
    expect(result.success).toBe(false);
    if (!result.success) expect(formatStudioImportError(result.error)).toContain("elements.0.id: Expected string");
  });
});
