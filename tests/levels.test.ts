import { describe, expect, it } from "vitest";
import { ancestryOf, childCounts, connectionsAtLevel, crossLevelConnections, descendantIds, elementsAtLevel, levelCount, mergeLevel, reparentElement, resolveFocus } from "../src/studio/levels/levels";
import { createStudioDocument, parseStudioDocument, type StudioElement } from "../src/studio/schema/studio-document";
import { studioDocumentToTldrawShapes, studioLevelToTldrawConnections, tldrawShapesToStudioDocument } from "../src/canvas/adapter/studio-tldraw-adapter";
import { generateHandoffMarkdown } from "../src/features/export/handoff";
import { starterTemplates, applyStarterTemplate } from "../src/studio/templates/starter-templates";
import kalshiLevels from "../docs/examples/kalshi-bot-levels.json";

const box = (id: string, name: string, parentElementId?: string, extra: Partial<StudioElement> = {}): StudioElement =>
  ({ id, type: "concept", name, transform: { x: 0, y: 0, width: 100, height: 50 }, ...(parentElementId ? { parentElementId } : {}), ...extra });

const tree = () => createStudioDocument({
  id: "doc", name: "Tree", mode: "graph",
  elements: [
    box("core", "Core loop", undefined, { intent: ["Keep it to one glance."] }),
    box("skill", "Skill"),
    box("mode-a", "Catch me up", "skill"),
    box("mode-b", "Podcast", "skill"),
    box("brief", "Evidence brief", "mode-b"),
    box("github", "GitHub"),
  ],
  connections: [
    { id: "core-skill", sourceElementId: "core", targetElementId: "skill", type: "flow" },
    { id: "a-b", sourceElementId: "mode-a", targetElementId: "mode-b", type: "dependency", label: "shares" },
    { id: "cross", sourceElementId: "mode-a", targetElementId: "github", type: "relationship" },
  ],
});

describe("altitude levels", () => {
  it("slices a document into levels", () => {
    const document = tree();
    expect(elementsAtLevel(document, null).map((element) => element.id)).toEqual(["core", "skill", "github"]);
    expect(elementsAtLevel(document, "skill").map((element) => element.id)).toEqual(["mode-a", "mode-b"]);
    expect(connectionsAtLevel(document, null).map((connection) => connection.id)).toEqual(["core-skill"]);
    expect(connectionsAtLevel(document, "skill").map((connection) => connection.id)).toEqual(["a-b"]);
    expect(crossLevelConnections(document, "skill").map((connection) => connection.id)).toEqual(["cross"]);
    expect(Object.fromEntries(childCounts(document))).toEqual({ skill: 2, "mode-b": 1 });
    expect(ancestryOf(document, "brief").map((element) => element.id)).toEqual(["skill", "mode-b", "brief"]);
    expect([...descendantIds(document, "skill")].sort()).toEqual(["brief", "mode-a", "mode-b"]);
    expect(levelCount(document)).toBe(3);
    expect(resolveFocus(document, "missing")).toBeNull();
    expect(resolveFocus(document, "skill")).toBe("skill");
  });

  it("rejects orphaned and circular parents", () => {
    const document = tree();
    expect(() => parseStudioDocument({ ...document, elements: [...document.elements, box("lost", "Lost", "nowhere")] })).toThrow(/Missing parent element/);
    expect(() => parseStudioDocument({ ...document, elements: document.elements.map((element) => element.id === "skill" ? { ...element, parentElementId: "brief" } : element) })).toThrow(/nested inside itself/);
    expect(() => parseStudioDocument({ ...document, elements: [box("self", "Self", "self")] })).toThrow(/own parent/);
    expect(() => reparentElement(document, "skill", "brief")).toThrow(/inside itself/);
    expect(reparentElement(document, "brief", null).elements.find((element) => element.id === "brief")?.parentElementId).toBeUndefined();
  });

  it("merges one level back without touching the others", () => {
    const document = tree();
    const shapes = studioDocumentToTldrawShapes(document, "skill");
    expect(shapes.map((shape) => shape.id)).toEqual(["shape:mode-a", "shape:mode-b"]);
    const connections = studioLevelToTldrawConnections(document, "skill");
    shapes[0].x = 400;
    const added = { ...studioDocumentToTldrawShapes(createStudioDocument({ id: "x", name: "x", mode: "graph", elements: [box("mode-c", "Suggest")] }))[0] };
    const merged = parseStudioDocument(tldrawShapesToStudioDocument([...shapes, added], document, connections, "skill"));
    expect(merged.elements.map((element) => element.id)).toEqual(["core", "skill", "mode-a", "mode-b", "brief", "github", "mode-c"]);
    expect(merged.elements.find((element) => element.id === "mode-c")?.parentElementId).toBe("skill");
    expect(merged.elements.find((element) => element.id === "mode-a")?.transform.x).toBe(400);
    expect(merged.connections.map((connection) => connection.id).sort()).toEqual(["a-b", "core-skill", "cross"]);
  });

  it("drops a deleted element's subtree and its connections", () => {
    const document = tree();
    const remaining = studioDocumentToTldrawShapes(document, "skill").filter((shape) => shape.id !== "shape:mode-b");
    const merged = mergeLevel(document, "skill", remaining.map((shape) => shape.meta.studioElement), []);
    expect(merged.elements.map((element) => element.id)).toEqual(["core", "skill", "mode-a", "github"]);
    expect(merged.connections.map((connection) => connection.id)).toEqual(["core-skill", "cross"]);
    expect(() => parseStudioDocument({ ...document, ...merged })).not.toThrow();
  });

  it("hands off one level with the zoomed-out context", () => {
    const document = tree();
    const markdown = generateHandoffMarkdown(document, { versionLabel: "Draft", focusElementId: "mode-b" });
    expect(markdown).toContain("**Level:** Root › Skill › Podcast (1 of 6 objects across 3 levels)");
    expect(markdown).toContain("- Skill (concept)");
    expect(markdown).toContain("  - Podcast (concept) — this level lives inside it");
    expect(markdown).toContain("**Neighbours at the level above**");
    expect(markdown).toContain("- Catch me up (concept)");
    expect(markdown).toContain("| Evidence brief | concept |");
    expect(markdown).not.toContain("| GitHub |");
    const root = generateHandoffMarkdown(document, { versionLabel: "Draft" });
    expect(root).toContain("- Skill — 2 nested objects, treat as a black box here");
    expect(root).toContain("Keep it to one glance.");
    expect(root).toContain("linked through `parentElementId`");
    const flat = generateHandoffMarkdown(createStudioDocument({ id: "f", name: "Flat", mode: "graph", elements: [box("a", "A")] }), { versionLabel: "Draft" });
    expect(flat).not.toContain("## Altitude");
  });

  it("ships a valid multi-level starter and example", () => {
    const template = starterTemplates.find((item) => item.id === "build-os-radio-levels")!;
    const document = parseStudioDocument(applyStarterTemplate(createStudioDocument({ id: "t", name: "t", mode: "graph" }), template));
    expect(levelCount(document)).toBe(2);
    expect(elementsAtLevel(document, null)).toHaveLength(5);
    expect(childCounts(document).get("radio-skill")).toBe(5);
    expect(childCounts(document).get("radio-github")).toBe(3);

    const example = parseStudioDocument(kalshiLevels);
    expect(levelCount(example)).toBe(2);
    expect(elementsAtLevel(example, null)).toHaveLength(14);
    expect(childCounts(example).size).toBe(5);
    expect(crossLevelConnections(example, null)).toHaveLength(0);
  });
});
