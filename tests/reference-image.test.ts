import { describe, expect, it } from "vitest";
import { createReferenceRecords, MAX_REFERENCE_IMAGE_BYTES, validateReferenceImage } from "../src/features/import/reference-image";

describe("reference image import", () => {
  it("fits an embedded image inside the visible canvas without changing its aspect ratio", () => {
    const records = createReferenceRecords({
      id: "test",
      file: { name: "existing-table.png", size: 2048, type: "image/png" },
      src: "data:image/png;base64,AA==",
      imageWidth: 2000,
      imageHeight: 1000,
      canvasX: 100,
      canvasY: 50,
      canvasWidth: 800,
      canvasHeight: 600,
      locked: true,
    });
    expect(records.asset.id).toBe("reference-asset-test");
    expect(records.element.content).toEqual({ assetId: records.asset.id });
    expect(records.element.transform).toMatchObject({ x: 100, y: 150, width: 800, height: 400, zIndex: -1 });
    expect(records.element.appearance).toEqual({ opacity: 1, hidden: false });
    expect(records.element.locked).toBe(true);
  });

  it("rejects unsupported and oversized files", () => {
    expect(() => validateReferenceImage({ size: 10, type: "image/svg+xml" })).toThrow(/PNG/);
    expect(() => validateReferenceImage({ size: MAX_REFERENCE_IMAGE_BYTES + 1, type: "image/png" })).toThrow(/8 MB/);
  });
});
