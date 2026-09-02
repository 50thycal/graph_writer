import { describe, expect, it } from "vitest";
import { semanticObjectsForMode } from "../src/studio/catalog/semantic-objects";
import { StudioElementSchema, type StudioDocument } from "../src/studio/schema/studio-document";

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
});
