import { describe, expect, it } from "vitest";
import { createHandoffBundle, generateHandoffMarkdown } from "../src/features/export/handoff";
import { createStudioDocument } from "../src/studio/schema/studio-document";

const document = createStudioDocument({
  id: "handoff-document",
  name: "Planning Flow",
  description: "Turn a request into an approved plan.",
  mode: "graph",
  createdAt: "2026-09-03T12:00:00.000Z",
  updatedAt: "2026-09-03T13:00:00.000Z",
  elements: [
    { id: "agent", type: "agent", name: "Planner", transform: { x: 300.4, y: 20.2, width: 240, height: 120 }, properties: { model: "" }, intent: ["Create an actionable plan."], implementationNotes: ["Preserve constraints."] },
    { id: "input", type: "input", name: "Request", transform: { x: 10.1, y: 20.1, width: 180, height: 90 }, properties: { required: true } },
  ],
  connections: [{ id: "analyze", sourceElementId: "input", targetElementId: "agent", type: "flow", label: "analyze", intent: ["Keep direction explicit."] }],
});

describe("handoff export", () => {
  it("generates deterministic intent, spatial, and flow context", () => {
    const markdown = generateHandoffMarkdown(document, { versionLabel: "Draft after v2" });
    expect(markdown).toContain("**Project:** Planning Flow");
    expect(markdown).toContain("### Planner (agent)");
    expect(markdown).toContain("## Semantic Properties");
    expect(markdown).toContain("| Request | input | required: true |");
    expect(markdown).toContain("| Request | input | 10 | 20 | 180 | 90 |");
    expect(markdown).toContain("Request → Planner (flow) — analyze");
    expect(markdown).toContain("Keep direction explicit.");
    expect(generateHandoffMarkdown(document, { versionLabel: "Draft after v2" })).toBe(markdown);
  });

  it("bundles matching JSON, Markdown, and PNG metadata", () => {
    const image = new Blob(["png"], { type: "image/png" });
    const bundle = createHandoffBundle(document, { blob: image, width: 1200, height: 700 }, { versionLabel: "Draft" });
    expect(JSON.parse(bundle.json)).toEqual(document);
    expect(bundle.copyText).toContain("## StudioDocument JSON");
    expect(bundle.copyText).toContain('"sourceElementId": "input"');
    expect(bundle.image).toBe(image);
    expect(bundle.baseName).toBe("planning-flow");
  });
});
