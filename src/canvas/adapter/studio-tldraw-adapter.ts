import type { StudioConnection, StudioDocument, StudioElement } from "../../studio/schema/studio-document";

export const STUDIO_META_KEY = "studioElement";
export const STUDIO_CONNECTION_META_KEY = "studioConnection";

export interface TldrawShapeRecord {
  id: string; type: "geo" | "image"; x: number; y: number; rotation: number;
  props: { w: number; h: number; label: string };
  meta: { [STUDIO_META_KEY]: StudioElement };
}

export interface TldrawConnectionRecord {
  id: string;
  sourceElementId: string;
  targetElementId: string;
  label: string;
  meta: { [STUDIO_CONNECTION_META_KEY]: StudioConnection };
}

export function studioElementToTldrawShape(element: StudioElement): TldrawShapeRecord {
  return {
    id: `shape:${element.id}`, type: element.type === "reference-image" ? "image" : "geo",
    x: element.transform.x, y: element.transform.y, rotation: element.transform.rotation ?? 0,
    props: { w: element.transform.width, h: element.transform.height, label: element.name ?? element.type },
    meta: { [STUDIO_META_KEY]: structuredClone(element) },
  };
}

export function studioConnectionToTldrawConnection(connection: StudioConnection): TldrawConnectionRecord {
  return {
    id: `shape:${connection.id}`,
    sourceElementId: connection.sourceElementId,
    targetElementId: connection.targetElementId,
    label: connection.label ?? "",
    meta: { [STUDIO_CONNECTION_META_KEY]: structuredClone(connection) },
  };
}

export function tldrawConnectionToStudioConnection(record: TldrawConnectionRecord): StudioConnection {
  return {
    ...structuredClone(record.meta[STUDIO_CONNECTION_META_KEY]),
    sourceElementId: record.sourceElementId,
    targetElementId: record.targetElementId,
    label: record.label || undefined,
  };
}

export function studioDocumentToTldrawConnections(document: StudioDocument): TldrawConnectionRecord[] {
  return document.connections.map(studioConnectionToTldrawConnection);
}

export function tldrawShapeToStudioElement(shape: TldrawShapeRecord): StudioElement {
  const semantic = structuredClone(shape.meta[STUDIO_META_KEY]);
  return {
    ...semantic,
    transform: { ...semantic.transform, x: shape.x, y: shape.y, width: shape.props.w, height: shape.props.h, rotation: shape.rotation },
  };
}

export const studioDocumentToTldrawShapes = (document: StudioDocument) =>
  document.elements.map(studioElementToTldrawShape);

export function tldrawShapesToStudioDocument(
  shapes: TldrawShapeRecord[],
  basis: StudioDocument,
  connections: TldrawConnectionRecord[] = [],
): StudioDocument {
  return {
    ...basis,
    updatedAt: new Date().toISOString(),
    elements: shapes.map(tldrawShapeToStudioElement),
    connections: connections.map(tldrawConnectionToStudioConnection),
  };
}
