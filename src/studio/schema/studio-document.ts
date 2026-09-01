import { z } from "zod";

export const STUDIO_SCHEMA_VERSION = 1 as const;

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
});

export const StudioDocumentSchema = z.object({
  schemaVersion: z.literal(STUDIO_SCHEMA_VERSION),
  id: z.string().min(1), name: z.string().min(1), description: z.string().optional(),
  mode: z.enum(["blank", "graph", "board-game", "ui", "architecture"]),
  createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
  elements: z.array(StudioElementSchema),
  connections: z.array(StudioConnectionSchema),
  groups: z.array(z.record(z.unknown())), assets: z.array(z.record(z.unknown())),
  metadata: z.record(z.unknown()),
});

export type StudioElement = z.infer<typeof StudioElementSchema>;
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
