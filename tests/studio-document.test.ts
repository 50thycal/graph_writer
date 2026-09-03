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
  it("keeps embedded reference images self-contained and validates their asset link", () => {
    const document = createStudioDocument({
      id: "reference-doc", name: "Reference", mode: "ui",
      assets: [{ id: "asset-1", type: "image", name: "screen.png", mimeType: "image/png", src: "data:image/png;base64,AA==", width: 1200, height: 800 }],
      elements: [{ id: "reference-1", type: "reference-image", name: "Existing screen", transform: { x: 0, y: 0, width: 600, height: 400 }, content: { assetId: "asset-1" }, locked: true }],
    });
    expect(parseStudioDocument(JSON.parse(JSON.stringify(document))).assets[0].name).toBe("screen.png");
    expect(() => parseStudioDocument({ ...document, assets: [] })).toThrow(/Missing reference image asset/);
  });
});
