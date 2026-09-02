import { describe, expect, it } from "vitest";
import { studioDocumentToTldrawShapes, tldrawShapesToStudioDocument } from "../src/canvas/adapter/studio-tldraw-adapter";
import { createStudioDocument } from "../src/studio/schema/studio-document";

describe("canvas adapter", () => {
  it("round-trips semantic metadata and changed geometry", () => {
    const document = createStudioDocument({ id: "doc-1", name: "Round trip", mode: "graph", elements: [{ id: "agent-1", type: "agent", name: "Researcher", transform: { x: 10, y: 20, width: 240, height: 120 }, properties: { retries: 2 }, intent: ["Gather evidence."], implementationNotes: ["Use authoritative sources."] }] });
    const shapes = studioDocumentToTldrawShapes(document);
    shapes[0].x = 90; shapes[0].props.w = 300;
    const restored = tldrawShapesToStudioDocument(shapes, document);
    expect(restored.elements[0].transform.x).toBe(90);
    expect(restored.elements[0].transform.width).toBe(300);
    expect(restored.elements[0].properties).toEqual(document.elements[0].properties);
    expect(restored.elements[0].intent).toEqual(document.elements[0].intent);
    expect(restored.elements[0].implementationNotes).toEqual(document.elements[0].implementationNotes);
  });
});
