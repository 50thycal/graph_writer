import { describe, expect, it } from "vitest";
import { propertyFieldsForPreset, semanticObjectsForMode } from "../src/studio/catalog/semantic-objects";
import { createStudioDocument, parseStudioDocument, StudioElementSchema, type StudioDocument } from "../src/studio/schema/studio-document";
import { applyStarterTemplate, starterTemplates } from "../src/studio/templates/starter-templates";

const modes: StudioDocument["mode"][] = ["blank", "graph", "board-game", "ui", "architecture"];

describe("semantic object catalog", () => {
  it("has unique, schema-compatible presets in every mode", () => {
    for (const mode of modes) {
      const presets = semanticObjectsForMode(mode);
      expect(presets.length).toBeGreaterThan(0);
      expect(new Set(presets.map((item) => item.type)).size).toBe(presets.length);
      for (const item of presets) {
        expect(() => StudioElementSchema.parse({
          id: `${mode}-${item.type}`,
          type: item.type,
          name: item.label,
          transform: { x: 0, y: 0, width: item.width, height: item.height },
          appearance: item.appearance,
          properties: item.properties,
          tags: item.tags,
        })).not.toThrow();
        expect(propertyFieldsForPreset(item).map((field) => field.key)).toEqual(Object.keys(item.properties));
      }
    }
  });

  it("includes the core graph and board-game objects", () => {
    expect(semanticObjectsForMode("graph").map((item) => item.type)).toEqual(expect.arrayContaining([
      "input", "agent", "tool", "transform", "gate", "human-checkpoint", "output",
    ]));
    expect(semanticObjectsForMode("board-game").map((item) => item.type)).toEqual(expect.arrayContaining([
      "board", "card", "deck", "token", "player-area", "track", "tabletop-panel", "rule",
    ]));
  });

  it("produces valid, connected starter canvases", () => {
    for (const template of starterTemplates) {
      const base = createStudioDocument({ id: `document-${template.id}`, name: template.name, mode: template.mode });
      const document = parseStudioDocument(applyStarterTemplate(base, template));
      expect(document.elements.length).toBeGreaterThanOrEqual(7);
      expect(document.metadata.starterTemplate).toBe(template.id);
      for (const connection of document.connections) {
        expect(document.elements.some((item) => item.id === connection.sourceElementId)).toBe(true);
        expect(document.elements.some((item) => item.id === connection.targetElementId)).toBe(true);
      }
    }
  });
});
