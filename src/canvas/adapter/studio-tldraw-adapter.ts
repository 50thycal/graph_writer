import type { StudioDocument, StudioElement } from "../../studio/schema/studio-document";

export const STUDIO_META_KEY = "studioElement";

export interface TldrawShapeRecord {
  id: string; type: "geo"; x: number; y: number; rotation: number;
  props: { w: number; h: number; label: string };
  meta: { [STUDIO_META_KEY]: StudioElement };
}

export function studioElementToTldrawShape(element: StudioElement): TldrawShapeRecord {
  return {
    id: `shape:${element.id}`, type: "geo",
    x: element.transform.x, y: element.transform.y, rotation: element.transform.rotation ?? 0,
    props: { w: element.transform.width, h: element.transform.height, label: element.name ?? element.type },
    meta: { [STUDIO_META_KEY]: structuredClone(element) },
  };
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

export function tldrawShapesToStudioDocument(shapes: TldrawShapeRecord[], basis: StudioDocument): StudioDocument {
  return { ...basis, updatedAt: new Date().toISOString(), elements: shapes.map(tldrawShapeToStudioElement) };
}
