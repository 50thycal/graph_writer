import type { StudioConnection, StudioDocument, StudioElement } from "../schema/studio-document";

/**
 * Altitude levels.
 *
 * A StudioDocument is one tree of canvases. Every element sits at exactly one level:
 * the root level (no `parentElementId`) or the detail level of another element.
 * "Zooming in" on an element shows only its children; "zooming out" returns to the
 * level that element lives on. Connections belong to the level of their endpoints.
 *
 * `focusElementId === null` means the root level.
 */

export type LevelFocus = string | null;

export function parentOf(element: StudioElement): LevelFocus {
  return element.parentElementId ?? null;
}

export function elementsAtLevel(document: StudioDocument, focus: LevelFocus): StudioElement[] {
  return document.elements.filter((element) => parentOf(element) === focus);
}

export function connectionsAtLevel(document: StudioDocument, focus: LevelFocus): StudioConnection[] {
  const visible = new Set(elementsAtLevel(document, focus).map((element) => element.id));
  return document.connections.filter((connection) => visible.has(connection.sourceElementId) && visible.has(connection.targetElementId));
}

export function childCounts(document: StudioDocument): Map<string, number> {
  const counts = new Map<string, number>();
  for (const element of document.elements) {
    if (element.parentElementId === undefined) continue;
    counts.set(element.parentElementId, (counts.get(element.parentElementId) ?? 0) + 1);
  }
  return counts;
}

export function descendantIds(document: StudioDocument, elementId: string): Set<string> {
  const childrenByParent = new Map<string, string[]>();
  for (const element of document.elements) {
    if (element.parentElementId === undefined) continue;
    childrenByParent.set(element.parentElementId, [...(childrenByParent.get(element.parentElementId) ?? []), element.id]);
  }
  const result = new Set<string>();
  const queue = [elementId];
  while (queue.length) {
    const current = queue.pop()!;
    for (const child of childrenByParent.get(current) ?? []) {
      if (result.has(child)) continue;
      result.add(child);
      queue.push(child);
    }
  }
  return result;
}

/** Root-first chain of elements above `focus`, ending with the focused element itself. Empty at the root. */
export function ancestryOf(document: StudioDocument, focus: LevelFocus): StudioElement[] {
  const byId = new Map(document.elements.map((element) => [element.id, element]));
  const chain: StudioElement[] = [];
  const seen = new Set<string>();
  let cursor = focus;
  while (cursor !== null) {
    const element = byId.get(cursor);
    if (!element || seen.has(cursor)) break;
    seen.add(cursor);
    chain.unshift(element);
    cursor = parentOf(element);
  }
  return chain;
}

export function depthOf(document: StudioDocument, focus: LevelFocus) {
  return ancestryOf(document, focus).length;
}

/** Number of altitude levels in the document: 1 for a flat canvas. */
export function levelCount(document: StudioDocument) {
  return Math.max(1, ...document.elements.map((element) => depthOf(document, element.id)));
}

/** A focus is only valid when the element still exists; otherwise fall back to the root. */
export function resolveFocus(document: StudioDocument, focus: LevelFocus): LevelFocus {
  return focus !== null && document.elements.some((element) => element.id === focus) ? focus : null;
}

export function elementDisplayName(element: StudioElement) {
  return element.name?.trim() || element.type;
}

/** Connections whose endpoints live on different levels, or where exactly one endpoint is on `focus`. */
export function crossLevelConnections(document: StudioDocument, focus: LevelFocus): StudioConnection[] {
  const byId = new Map(document.elements.map((element) => [element.id, element]));
  return document.connections.filter((connection) => {
    const source = byId.get(connection.sourceElementId);
    const target = byId.get(connection.targetElementId);
    if (!source || !target) return false;
    const sourceHere = parentOf(source) === focus;
    const targetHere = parentOf(target) === focus;
    return sourceHere !== targetHere;
  });
}

/**
 * Replace one level of `basis` with the elements and connections currently on the canvas.
 * Everything on other levels is preserved untouched. Elements deleted from the level take
 * their whole subtree (and any connection touching it) with them.
 */
export function mergeLevel(
  basis: StudioDocument,
  focus: LevelFocus,
  levelElements: StudioElement[],
  levelConnections: StudioConnection[],
): Pick<StudioDocument, "elements" | "connections"> {
  const kept = new Set(levelElements.map((element) => element.id));
  const removed = new Set<string>();
  for (const element of elementsAtLevel(basis, focus)) {
    if (kept.has(element.id)) continue;
    removed.add(element.id);
    for (const id of descendantIds(basis, element.id)) removed.add(id);
  }
  const preservedElements = basis.elements.filter((element) => parentOf(element) !== focus && !removed.has(element.id));
  const normalizedLevel = levelElements.map((element) => ({
    ...element,
    parentElementId: focus ?? undefined,
  }));
  const levelIds = new Set(normalizedLevel.map((element) => element.id));
  const preservedConnections = basis.connections.filter((connection) => {
    if (removed.has(connection.sourceElementId) || removed.has(connection.targetElementId)) return false;
    // Connections fully inside the level are owned by the canvas now.
    return !(levelIds.has(connection.sourceElementId) && levelIds.has(connection.targetElementId));
  });
  const order = new Map(basis.elements.map((element, index) => [element.id, index]));
  const elements = [...preservedElements, ...normalizedLevel]
    .sort((left, right) => (order.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(right.id) ?? Number.MAX_SAFE_INTEGER));
  return { elements, connections: [...preservedConnections, ...levelConnections] };
}

/** Move an element and its subtree so that it lives on `focus`. Cycles are refused. */
export function reparentElement(document: StudioDocument, elementId: string, focus: LevelFocus): StudioDocument {
  if (focus !== null && (focus === elementId || descendantIds(document, elementId).has(focus))) {
    throw new Error("An element cannot be nested inside itself.");
  }
  return {
    ...document,
    elements: document.elements.map((element) => element.id === elementId ? { ...element, parentElementId: focus ?? undefined } : element),
  };
}
