import { z } from "zod";

export const STUDIO_SCHEMA_VERSION = 1 as const;

export const StudioAssetSchema = z.object({
  id: z.string().min(1),
  type: z.literal("image"),
  name: z.string().min(1),
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp", "image/gif"]),
  src: z.string().startsWith("data:image/"),
  width: z.number().positive(),
  height: z.number().positive(),
  fileSize: z.number().nonnegative().optional(),
});

export const StudioElementSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  subtype: z.string().optional(),
  name: z.string().optional(),
  transform: z.object({
    x: z.number().finite(), y: z.number().finite(),
    width: z.number().positive(), height: z.number().positive(),
    rotation: z.number().finite().optional(), zIndex: z.number().int().optional(),
  }),
  appearance: z.record(z.unknown()).optional(),
  content: z.record(z.unknown()).optional(),
  properties: z.record(z.unknown()).optional(),
  intent: z.array(z.string()).optional(),
  implementationNotes: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  locked: z.boolean().optional(),
});

export const StudioConnectionSchema = z.object({
  id: z.string().min(1),
  sourceElementId: z.string().min(1),
  targetElementId: z.string().min(1),
  type: z.enum(["flow", "dependency", "relationship", "loop", "generic"]),
  label: z.string().optional(),
  properties: z.record(z.unknown()).optional(),
  intent: z.array(z.string()).optional(),
  implementationNotes: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
});

export const StudioDocumentSchema = z.object({
  schemaVersion: z.literal(STUDIO_SCHEMA_VERSION),
  id: z.string().min(1), name: z.string().min(1), description: z.string().optional(),
  mode: z.enum(["blank", "graph", "board-game", "ui", "architecture"]),
  createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
  elements: z.array(StudioElementSchema),
  connections: z.array(StudioConnectionSchema),
  groups: z.array(z.record(z.unknown())), assets: z.array(StudioAssetSchema),
  metadata: z.record(z.unknown()),
}).superRefine((document, context) => {
  const elementIds = new Set<string>();
  const assetIds = new Set<string>();
  for (const [index, asset] of document.assets.entries()) {
    if (assetIds.has(asset.id)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["assets", index, "id"], message: `Duplicate asset ID: ${asset.id}` });
    }
    assetIds.add(asset.id);
  }
  for (const [index, element] of document.elements.entries()) {
    if (elementIds.has(element.id)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["elements", index, "id"], message: `Duplicate element ID: ${element.id}` });
    }
    elementIds.add(element.id);
    if (element.type === "reference-image") {
      const assetId = element.content?.assetId;
      if (typeof assetId !== "string" || !assetIds.has(assetId)) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["elements", index, "content", "assetId"], message: `Missing reference image asset: ${String(assetId)}` });
      }
    }
  }

  const connectionIds = new Set<string>();
  for (const [index, connection] of document.connections.entries()) {
    if (connectionIds.has(connection.id)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["connections", index, "id"], message: `Duplicate connection ID: ${connection.id}` });
    }
    connectionIds.add(connection.id);
    if (!elementIds.has(connection.sourceElementId)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["connections", index, "sourceElementId"], message: `Missing source element: ${connection.sourceElementId}` });
    }
    if (!elementIds.has(connection.targetElementId)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["connections", index, "targetElementId"], message: `Missing target element: ${connection.targetElementId}` });
    }
  }
});

export type StudioElement = z.infer<typeof StudioElementSchema>;
export type StudioConnection = z.infer<typeof StudioConnectionSchema>;
export type StudioAsset = z.infer<typeof StudioAssetSchema>;
export type StudioDocument = z.infer<typeof StudioDocumentSchema>;

export function migrateStudioDocument(value: unknown): unknown {
  if (!value || typeof value !== "object") throw new Error("Studio document must be a JSON object.");
  const version = (value as { schemaVersion?: unknown }).schemaVersion;
  if (version !== STUDIO_SCHEMA_VERSION) {
    throw new Error(`Unsupported StudioDocument schema version: ${String(version)}`);
  }
  return value;
}

export function parseStudioDocument(value: unknown): StudioDocument {
  return StudioDocumentSchema.parse(migrateStudioDocument(value));
}

export function createStudioDocument(
  partial: Pick<StudioDocument, "id" | "name" | "mode"> & Partial<Omit<StudioDocument, "id" | "name" | "mode" | "schemaVersion">>,
): StudioDocument {
  const now = new Date().toISOString();
  return StudioDocumentSchema.parse({
    schemaVersion: STUDIO_SCHEMA_VERSION, createdAt: now, updatedAt: now,
    elements: [], connections: [], groups: [], assets: [], metadata: {}, ...partial,
  });
}
