import type { StudioAsset, StudioElement } from "../../studio/schema/studio-document";

export const MAX_REFERENCE_IMAGE_BYTES = 8 * 1024 * 1024;
export const REFERENCE_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;

export function validateReferenceImage(file: Pick<File, "size" | "type">) {
  if (!REFERENCE_IMAGE_TYPES.includes(file.type as (typeof REFERENCE_IMAGE_TYPES)[number])) {
    throw new Error("Use a PNG, JPEG, WebP, or GIF reference image.");
  }
  if (file.size > MAX_REFERENCE_IMAGE_BYTES) {
    throw new Error("Reference images must be 8 MB or smaller.");
  }
}

export function readReferenceImage(file: File): Promise<{ src: string; width: number; height: number }> {
  validateReferenceImage(file);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that image."));
    reader.onload = () => {
      const src = String(reader.result ?? "");
      const image = new Image();
      image.onerror = () => reject(new Error("That image could not be displayed."));
      image.onload = () => resolve({ src, width: image.naturalWidth, height: image.naturalHeight });
      image.src = src;
    };
    reader.readAsDataURL(file);
  });
}

export function createReferenceRecords(input: {
  file: Pick<File, "name" | "size" | "type">;
  src: string;
  imageWidth: number;
  imageHeight: number;
  canvasX: number;
  canvasY: number;
  canvasWidth: number;
  canvasHeight: number;
  locked: boolean;
  id?: string;
}): { asset: StudioAsset; element: StudioElement } {
  const id = input.id ?? crypto.randomUUID();
  const assetId = `reference-asset-${id}`;
  const elementId = `reference-image-${id}`;
  const scale = Math.min(input.canvasWidth / input.imageWidth, input.canvasHeight / input.imageHeight, 1);
  const width = Math.max(1, input.imageWidth * scale);
  const height = Math.max(1, input.imageHeight * scale);
  const name = input.file.name.replace(/\.[^.]+$/, "") || "Reference image";

  return {
    asset: {
      id: assetId,
      type: "image",
      name: input.file.name,
      mimeType: input.file.type as StudioAsset["mimeType"],
      src: input.src,
      width: input.imageWidth,
      height: input.imageHeight,
      fileSize: input.file.size,
    },
    element: {
      id: elementId,
      type: "reference-image",
      name,
      transform: {
        x: input.canvasX + (input.canvasWidth - width) / 2,
        y: input.canvasY + (input.canvasHeight - height) / 2,
        width,
        height,
        zIndex: input.locked ? -1 : undefined,
      },
      content: { assetId },
      appearance: { opacity: 1, hidden: false },
      properties: { role: input.locked ? "locked-background" : "reference", originalFileName: input.file.name },
      intent: ["Use this image as visual reference context for the design."],
      implementationNotes: [],
      tags: ["reference", "image"],
      locked: input.locked,
    },
  };
}
