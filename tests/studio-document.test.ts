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
  it("accepts loops and rejects dangling semantic connections", () => {
    const base = createStudioDocument({
      id: "doc-1", name: "Graph", mode: "graph",
      elements: [{ id: "agent-1", type: "agent", transform: { x: 0, y: 0, width: 100, height: 50 } }],
      connections: [{ id: "loop-1", sourceElementId: "agent-1", targetElementId: "agent-1", type: "loop" }],
    });
    expect(parseStudioDocument(base).connections[0].type).toBe("loop");
    expect(() => parseStudioDocument({
      ...base,
      connections: [{ id: "bad", sourceElementId: "agent-1", targetElementId: "missing", type: "flow" }],
    })).toThrow(/Missing target element/);
  });
});
