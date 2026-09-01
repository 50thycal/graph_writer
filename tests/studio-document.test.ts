import { describe, expect, it } from "vitest";
import { createStudioDocument, parseStudioDocument } from "../src/studio/schema/studio-document";

describe("StudioDocument", () => {
  it("creates and parses schema v1", () => {
    const document = createStudioDocument({ id: "doc-1", name: "Test", mode: "graph" });
    expect(parseStudioDocument(JSON.parse(JSON.stringify(document))).schemaVersion).toBe(1);
  });
  it("rejects unsupported versions", () => {
    expect(() => parseStudioDocument({ schemaVersion: 99 })).toThrow(/Unsupported/);
  });
  it("rejects invalid geometry", () => {
    const document = createStudioDocument({ id: "doc-1", name: "Test", mode: "blank" });
    expect(() => parseStudioDocument({ ...document, elements: [{ id: "bad", type: "note", transform: { x: 0, y: 0, width: 0, height: 20 } }] })).toThrow();
  });
});
