import { describe, expect, it } from "vitest";
import { studioDocumentToTldrawConnections, studioDocumentToTldrawShapes, tldrawShapesToStudioDocument } from "../src/canvas/adapter/studio-tldraw-adapter";
import { createStudioDocument } from "../src/studio/schema/studio-document";

describe("canvas adapter", () => {
  it("round-trips semantic metadata and changed geometry", () => {
    const document = createStudioDocument({ id: "doc-1", name: "Round trip", description: "Preserve me", mode: "graph", metadata: { owner: "studio" }, elements: [{ id: "agent-1", type: "agent", name: "Researcher", transform: { x: 10, y: 20, width: 240, height: 120 }, properties: { retries: 2 }, intent: ["Gather evidence."], implementationNotes: ["Use authoritative sources."] }] });
    const shapes = studioDocumentToTldrawShapes(document);
    shapes[0].x = 90; shapes[0].props.w = 300;
    const restored = tldrawShapesToStudioDocument(shapes, document);
    expect(restored.elements[0].transform.x).toBe(90);
    expect(restored.elements[0].transform.width).toBe(300);
    expect(restored.elements[0].properties).toEqual(document.elements[0].properties);
    expect(restored.elements[0].intent).toEqual(document.elements[0].intent);
    expect(restored.elements[0].implementationNotes).toEqual(document.elements[0].implementationNotes);
    expect(restored.id).toBe("doc-1");
    expect(restored.name).toBe("Round trip");
    expect(restored.description).toBe("Preserve me");
    expect(restored.mode).toBe("graph");
    expect(restored.metadata).toEqual({ owner: "studio" });
    expect(restored.createdAt).toBe(document.createdAt);
  });
  it("round-trips connection direction and semantic metadata", () => {
    const document = createStudioDocument({
      id: "doc-1", name: "Connections", mode: "graph",
      elements: [
        { id: "source", type: "agent", transform: { x: 0, y: 0, width: 100, height: 60 } },
        { id: "target", type: "gate", transform: { x: 200, y: 0, width: 100, height: 60 } },
      ],
      connections: [{
        id: "flow-1", sourceElementId: "source", targetElementId: "target", type: "flow",
        label: "approved", properties: { condition: "score > 0.8" }, intent: ["Only continue after approval."],
      }],
    });
    const shapes = studioDocumentToTldrawShapes(document);
    const connections = studioDocumentToTldrawConnections(document);
    const restored = tldrawShapesToStudioDocument(shapes, document, connections);
    expect(restored.connections).toEqual(document.connections);
  });
});
