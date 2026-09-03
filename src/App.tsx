import { useCallback, useEffect, useRef, useState } from "react";
import { createShapeId, getArrowBindings, type Editor, type TLArrowShape, type TLGeoShape, type TLImageShape, Tldraw } from "tldraw";
import { AssetRecordType, toRichText } from "@tldraw/tlschema";
import { STUDIO_CONNECTION_META_KEY, STUDIO_META_KEY, studioConnectionToTldrawConnection, studioElementToTldrawShape, tldrawShapesToStudioDocument, type TldrawConnectionRecord, type TldrawShapeRecord } from "./canvas/adapter/studio-tldraw-adapter";
import { parseStudioDocument, type StudioAsset, type StudioConnection, type StudioElement } from "./studio/schema/studio-document";
import { ProjectDashboard } from "./features/projects/ProjectDashboard";
import { IndexedDbProjectRepository, createProject, duplicateProject, snapshotProject, type ProjectVersion, type StudioProject } from "./features/projects/project-repository";
import { findSemanticObjectPreset, propertyFieldsForPreset, semanticObjectsForMode, type SemanticObjectPreset, type SemanticPropertyField } from "./studio/catalog/semantic-objects";
import { applyStarterTemplate, type StarterTemplate } from "./studio/templates/starter-templates";
import { HandoffPanel } from "./features/export/HandoffPanel";
import { createHandoffBundle, type HandoffBundle } from "./features/export/handoff";
import { createReferenceRecords, readReferenceImage, REFERENCE_IMAGE_TYPES } from "./features/import/reference-image";

const projectRepository = new IndexedDbProjectRepository();
const AUTO_OPEN_INSPECTOR_KEY = "graph-writer:auto-open-inspector";
const TOP_ALIGNED_CONTAINER_TYPES = new Set(["board", "container", "screen", "tabletop-panel"]);

function routedProjectId() {
  const match = window.location.hash.match(/^#project=(.+)$/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

function addToEditor(editor: Editor, element: StudioElement, assets: StudioAsset[] = []) {
  const record = studioElementToTldrawShape(element);
  if (record.type === "image") {
    const studioAsset = assets.find((asset) => asset.id === element.content?.assetId);
    if (!studioAsset) throw new Error(`Could not find the image data for ${element.name ?? element.id}.`);
    const assetId = AssetRecordType.createId(studioAsset.id);
    if (!editor.getAsset(assetId)) {
      editor.createAssets([{
        id: assetId,
        typeName: "asset",
        type: "image",
        props: {
          name: studioAsset.name,
          src: studioAsset.src,
          w: studioAsset.width,
          h: studioAsset.height,
          mimeType: studioAsset.mimeType,
          fileSize: studioAsset.fileSize,
          isAnimated: studioAsset.mimeType === "image/gif",
        },
        meta: {},
      }]);
    }
    const shapeId = createShapeId(element.id);
    editor.createShape({
      id: shapeId,
      type: "image",
      x: record.x,
      y: record.y,
      rotation: record.rotation,
      isLocked: element.locked,
      props: { assetId, w: record.props.w, h: record.props.h },
      meta: { [STUDIO_META_KEY]: JSON.parse(JSON.stringify(record.meta[STUDIO_META_KEY])) },
    });
    if (element.locked || element.transform.zIndex === -1) editor.sendToBack([shapeId]);
    return;
  }
  const appearance = element.appearance ?? {};
  const isContainer = TOP_ALIGNED_CONTAINER_TYPES.has(element.type);
  editor.createShape({
    id: createShapeId(element.id), type: "geo", x: record.x, y: record.y, rotation: record.rotation,
    isLocked: element.locked,
    props: {
      w: record.props.w,
      h: record.props.h,
      geo: (appearance.shape ?? "rectangle") as TLGeoShape["props"]["geo"],
      fill: (appearance.fill ?? "solid") as TLGeoShape["props"]["fill"],
      color: (appearance.color ?? "blue") as TLGeoShape["props"]["color"],
      size: "m",
      align: isContainer ? "start" : "middle",
      verticalAlign: isContainer ? "start" : "middle",
      richText: toRichText(record.props.label),
    },
    meta: { [STUDIO_META_KEY]: JSON.parse(JSON.stringify(record.meta[STUDIO_META_KEY])) },
  });
}

function readShapes(editor: Editor): TldrawShapeRecord[] {
  return editor.getCurrentPageShapes()
    .filter((shape): shape is TLGeoShape | TLImageShape => (shape.type === "geo" || shape.type === "image") && Boolean(shape.meta[STUDIO_META_KEY]))
    .map((shape) => {
      const semantic = shape.meta[STUDIO_META_KEY] as StudioElement;
      const visibleLabel = shape.type === "geo" ? editor.getShapeUtil(shape).getText(shape)?.trim() : undefined;
      return {
        id: shape.id, type: shape.type, x: shape.x, y: shape.y, rotation: shape.rotation,
        props: {
          w: shape.props.w,
          h: shape.props.h,
          label: visibleLabel || semantic.name || "Semantic object",
        },
        meta: {
          [STUDIO_META_KEY]: {
            ...semantic,
            name: visibleLabel || semantic.name,
            locked: shape.isLocked,
          },
        },
      };
    });
}

function readConnection(editor: Editor, arrow: TLArrowShape): TldrawConnectionRecord | null {
  const bindings = getArrowBindings(editor, arrow);
  if (!bindings.start || !bindings.end) return null;
  const source = editor.getShape(bindings.start.toId);
  const target = editor.getShape(bindings.end.toId);
  const sourceElement = source?.meta[STUDIO_META_KEY] as StudioElement | undefined;
  const targetElement = target?.meta[STUDIO_META_KEY] as StudioElement | undefined;
  if (!sourceElement || !targetElement) return null;

  const stored = arrow.meta[STUDIO_CONNECTION_META_KEY] as StudioConnection | undefined;
  const connection: StudioConnection = {
    ...(stored ?? {
      id: `connection-${arrow.id.replace(/^shape:/, "")}`,
      type: sourceElement.id === targetElement.id ? "loop" : "flow",
      properties: {},
    }),
    sourceElementId: sourceElement.id,
    targetElementId: targetElement.id,
    label: editor.getShapeUtil(arrow).getText(arrow)?.trim() || stored?.label || undefined,
  };
  return {
    id: arrow.id,
    sourceElementId: connection.sourceElementId,
    targetElementId: connection.targetElementId,
    label: connection.label ?? "",
    meta: { [STUDIO_CONNECTION_META_KEY]: connection },
  };
}

function readConnections(editor: Editor): TldrawConnectionRecord[] {
  return editor.getCurrentPageShapes()
    .filter((shape): shape is TLArrowShape => shape.type === "arrow")
    .map((arrow) => readConnection(editor, arrow))
    .filter((connection): connection is TldrawConnectionRecord => Boolean(connection));
}

function bindArrow(editor: Editor, arrowId: TLArrowShape["id"], sourceElementId: string, targetElementId: string) {
  editor.createBindings([
    { type: "arrow", fromId: arrowId, toId: createShapeId(sourceElementId), props: { terminal: "start", normalizedAnchor: { x: 0.5, y: 0.5 }, isExact: false, isPrecise: false } },
    { type: "arrow", fromId: arrowId, toId: createShapeId(targetElementId), props: { terminal: "end", normalizedAnchor: { x: 0.5, y: 0.5 }, isExact: false, isPrecise: false } },
  ]);
}

function addConnectionToEditor(editor: Editor, connection: StudioConnection) {
  const record = studioConnectionToTldrawConnection(connection);
  const sourceBounds = editor.getShapePageBounds(createShapeId(connection.sourceElementId));
  const targetBounds = editor.getShapePageBounds(createShapeId(connection.targetElementId));
  if (!sourceBounds || !targetBounds) throw new Error(`Could not restore connection ${connection.id}.`);
  const arrowId = createShapeId(`connection-${connection.id}`);
  editor.createShape({
    id: arrowId,
    type: "arrow",
    x: sourceBounds.center.x,
    y: sourceBounds.center.y,
    props: {
      start: { x: 0, y: 0 },
      end: { x: targetBounds.center.x - sourceBounds.center.x, y: targetBounds.center.y - sourceBounds.center.y },
      arrowheadEnd: "arrow",
      richText: toRichText(record.label),
    },
    meta: { [STUDIO_CONNECTION_META_KEY]: JSON.parse(JSON.stringify(connection)) },
  });
  bindArrow(editor, arrowId, connection.sourceElementId, connection.targetElementId);
  return arrowId;
}

interface InspectorDraft {
  name: string;
  type: string;
  intent: string;
  implementationNotes: string;
  tags: string;
  properties: string;
}

interface ConnectionDraft {
  label: string;
  type: StudioConnection["type"];
  sourceElementId: string;
  targetElementId: string;
  intent: string;
  implementationNotes: string;
  tags: string;
  properties: string;
}

function elementToDraft(element: StudioElement): InspectorDraft {
  return {
    name: element.name ?? "",
    type: element.type,
    intent: (element.intent ?? []).join("\n"),
    implementationNotes: (element.implementationNotes ?? []).join("\n"),
    tags: (element.tags ?? []).join(", "),
    properties: JSON.stringify(element.properties ?? {}, null, 2),
  };
}

function connectionToDraft(connection: StudioConnection): ConnectionDraft {
  return {
    label: connection.label ?? "",
    type: connection.type,
    sourceElementId: connection.sourceElementId,
    targetElementId: connection.targetElementId,
    intent: (connection.intent ?? []).join("\n"),
    implementationNotes: (connection.implementationNotes ?? []).join("\n"),
    tags: (connection.tags ?? []).join(", "),
    properties: JSON.stringify(connection.properties ?? {}, null, 2),
  };
}

function parseDraftProperties(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value || "{}");
    return parsed && !Array.isArray(parsed) && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function propertyInputValue(value: unknown, field: SemanticPropertyField) {
  if (field.type === "list") return Array.isArray(value) ? value.join(", ") : "";
  if (field.type === "boolean") return Boolean(value);
  return value === undefined || value === null ? "" : String(value);
}

export function App() {
  const [projects, setProjects] = useState<StudioProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [activeProject, setActiveProject] = useState<StudioProject | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [revision, setRevision] = useState(0);
  const [message, setMessage] = useState("Schema v1 ready");
  const [draft, setDraft] = useState<InspectorDraft | null>(null);
  const [connectionDraft, setConnectionDraft] = useState<ConnectionDraft | null>(null);
  const [connectionSourceId, setConnectionSourceId] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [handoffBundle, setHandoffBundle] = useState<HandoffBundle | null>(null);
  const [handoffError, setHandoffError] = useState<string | null>(null);
  const [autoOpenInspector, setAutoOpenInspector] = useState(() => window.localStorage.getItem(AUTO_OPEN_INSPECTOR_KEY) !== "false");
  const [versionNote, setVersionNote] = useState("");
  const [saveStatus, setSaveStatus] = useState<"saving" | "saved" | "error">("saved");
  const fileInput = useRef<HTMLInputElement>(null);
  const referenceImageInput = useRef<HTMLInputElement>(null);
  const referenceImportLocked = useRef(false);
  const activeProjectRef = useRef<StudioProject | null>(null);
  const saveTimer = useRef<number | undefined>(undefined);
  const stopAutosave = useRef<(() => void) | undefined>(undefined);
  const hydrating = useRef(false);

  const rememberProject = useCallback((project: StudioProject) => {
    activeProjectRef.current = project;
    setActiveProject(project);
    setProjects((current) => [project, ...current.filter((item) => item.id !== project.id)]
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)));
  }, []);

  const activateProject = useCallback((project: StudioProject) => {
    const copy = structuredClone(project);
    activeProjectRef.current = copy;
    setActiveProject(copy);
    setEditor(null);
    setInspectorOpen(false);
    setVersionsOpen(false);
    setPaletteOpen(false);
    setHandoffOpen(false);
    setHandoffBundle(null);
    setHandoffError(null);
  }, []);

  const refreshProjects = useCallback(async () => {
    try {
      const storedProjects = await projectRepository.listProjects();
      setProjects(storedProjects);
      const routeId = routedProjectId();
      const routedProject = routeId ? storedProjects.find((project) => project.id === routeId) : undefined;
      if (routedProject) activateProject(routedProject);
    } finally {
      setProjectsLoading(false);
    }
  }, [activateProject]);

  useEffect(() => {
    const routeId = routedProjectId();
    if (routeId && window.history.state?.projectId !== routeId) {
      const projectUrl = window.location.href;
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      window.history.pushState({ projectId: routeId }, "", projectUrl);
    }
    void refreshProjects();
  }, [refreshProjects]);

  // Selection lives in tldraw's session state, so listen to the whole store.
  // A document-only listener misses select() calls made immediately after creating a shape.
  useEffect(() => editor?.store.listen(() => setRevision((value) => value + 1), { scope: "all" }), [editor]);

  const scheduleAutosave = useCallback((instance: Editor) => {
      if (hydrating.current) return;
      window.clearTimeout(saveTimer.current);
      setSaveStatus("saving");
      saveTimer.current = window.setTimeout(() => {
        const current = activeProjectRef.current;
        if (!current) return;
        const document = parseStudioDocument(tldrawShapesToStudioDocument(readShapes(instance), current.document, readConnections(instance)));
        const updated = { ...current, name: document.name, mode: document.mode, updatedAt: document.updatedAt, document };
        void projectRepository.saveProject(updated)
          .then(() => { rememberProject(updated); setSaveStatus("saved"); })
          .catch(() => setSaveStatus("error"));
      }, 450);
  }, [rememberProject]);

  useEffect(() => () => {
    stopAutosave.current?.();
    window.clearTimeout(saveTimer.current);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(AUTO_OPEN_INSPECTOR_KEY, String(autoOpenInspector));
  }, [autoOpenInspector]);

  useEffect(() => {
    const followBrowserHistory = () => {
      const routeId = routedProjectId();
      if (routeId) {
        void projectRepository.loadProject(routeId).then((project) => {
          if (project && routedProjectId() === routeId) activateProject(project);
        });
        return;
      }
      window.clearTimeout(saveTimer.current);
      stopAutosave.current?.();
      stopAutosave.current = undefined;
      const current = activeProjectRef.current;
      if (current && editor) {
        const document = parseStudioDocument(tldrawShapesToStudioDocument(readShapes(editor), current.document, readConnections(editor)));
        void projectRepository.saveProject({ ...current, updatedAt: document.updatedAt, document });
      }
      activeProjectRef.current = null;
      setActiveProject(null);
      setEditor(null);
      setInspectorOpen(false);
      setVersionsOpen(false);
      setPaletteOpen(false);
      setHandoffOpen(false);
      setHandoffBundle(null);
      setHandoffError(null);
      void refreshProjects();
    };
    window.addEventListener("popstate", followBrowserHistory);
    return () => window.removeEventListener("popstate", followBrowserHistory);
  }, [activateProject, editor, refreshProjects]);

  const onMount = useCallback((instance: Editor) => {
    setEditor(instance);
    const project = activeProjectRef.current;
    if (!project) return;
    stopAutosave.current?.();
    stopAutosave.current = instance.store.listen(() => scheduleAutosave(instance), { scope: "document" });
    hydrating.current = true;
    if (instance.getCurrentPageShapes().length) instance.deleteShapes(Array.from(instance.getCurrentPageShapeIds()));
    project.document.elements.forEach((element) => addToEditor(instance, element, project.document.assets));
    project.document.connections.forEach((connection) => addConnectionToEditor(instance, connection));
    if (project.document.elements.length) instance.zoomToFit({ animation: { duration: 240 } });
    hydrating.current = false;
  }, [scheduleAutosave]);

  const addObject = (preset: SemanticObjectPreset) => {
    if (!editor) return;
    const id = `${preset.type}-${crypto.randomUUID()}`;
    const center = editor.getViewportPageBounds().center;
    addToEditor(editor, {
      id,
      type: preset.type,
      name: `New ${preset.label}`,
      transform: { x: center.x - preset.width / 2, y: center.y - preset.height / 2, width: preset.width, height: preset.height },
      appearance: preset.appearance,
      properties: structuredClone(preset.properties),
      intent: [],
      implementationNotes: [],
      tags: [...preset.tags],
    });
    editor.select(createShapeId(id));
    setPaletteOpen(false);
    setMessage(`${preset.label} added`);
  };

  const prepareHandoff = async () => {
    if (!editor) return;
    const current = activeProjectRef.current;
    if (!current) return;

    setVersionsOpen(false);
    setPaletteOpen(false);
    setInspectorOpen(false);
    setHandoffBundle(null);
    setHandoffError(null);
    setHandoffOpen(true);

    try {
      const shapeIds = Array.from(editor.getCurrentPageShapeIds());
      if (!shapeIds.length) throw new Error("Add at least one object or annotation before creating a handoff.");
      const document = parseStudioDocument(tldrawShapesToStudioDocument(readShapes(editor), current.document, readConnections(editor)));
      await editor.fonts.loadRequiredFontsForCurrentPage(editor.options.maxFontsToLoadBeforeRender);
      const image = await editor.toImage(shapeIds, { format: "png", background: true, darkMode: false, padding: 48, pixelRatio: 2 });
      const latestVersion = current.versions.at(-1)?.number;
      const versionLabel = latestVersion ? `Draft after v${latestVersion}` : "Draft";
      setHandoffBundle(createHandoffBundle(document, image, { versionLabel }));
      setMessage("Design handoff ready");
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Could not create the design handoff.";
      setHandoffError(reason);
      setMessage(reason);
    }
  };

  const importJson = async (file: File) => {
    if (!editor) return;
    try {
      const document = parseStudioDocument(JSON.parse(await file.text()));
      const current = activeProjectRef.current;
      if (!current) return;
      hydrating.current = true;
      editor.deleteShapes(Array.from(editor.getCurrentPageShapeIds()));
      document.elements.forEach((element) => addToEditor(editor, element, document.assets));
      document.connections.forEach((connection) => addConnectionToEditor(editor, connection));
      editor.zoomToFit({ animation: { duration: 240 } });
      hydrating.current = false;
      const importedProject = { ...current, name: document.name, mode: document.mode, updatedAt: new Date().toISOString(), document };
      await projectRepository.saveProject(importedProject);
      rememberProject(importedProject);
      setSaveStatus("saved");
      setMessage(`Imported ${document.elements.length} semantic objects`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import failed");
    }
  };

  const count = editor ? readShapes(editor).length : activeProject?.document.elements.length ?? 0;
  const selectedShape = editor?.getOnlySelectedShape() ?? null;
  const selectedElement = selectedShape?.meta[STUDIO_META_KEY] as StudioElement | undefined;
  const selectedConnection = editor && selectedShape?.type === "arrow" ? readConnection(editor, selectedShape) : null;
  const selectedConnectionData = selectedConnection?.meta[STUDIO_CONNECTION_META_KEY];
  const hasSemanticSelection = Boolean(selectedElement || selectedConnectionData);
  const semanticPresets = activeProject ? semanticObjectsForMode(activeProject.mode) : [];
  const liveReferenceElements = editor
    ? readShapes(editor).map((shape) => shape.meta[STUDIO_META_KEY]).filter((element) => element.type === "reference-image")
    : activeProject?.document.elements.filter((element) => element.type === "reference-image") ?? [];
  const lockedReferenceCount = liveReferenceElements.filter((element) => element.locked).length;
  const selectedPreset = selectedElement && activeProject ? findSemanticObjectPreset(selectedElement.type, activeProject.mode) : undefined;
  const selectedPropertyFields = selectedPreset ? propertyFieldsForPreset(selectedPreset) : [];
  const selectedProperties = draft ? parseDraftProperties(draft.properties) : {};

  useEffect(() => {
    setDraft(selectedElement ? elementToDraft(selectedElement) : null);
    setConnectionDraft(selectedConnectionData ? connectionToDraft(selectedConnectionData) : null);
    setInspectorOpen(autoOpenInspector && hasSemanticSelection);
  }, [selectedShape?.id, autoOpenInspector]);

  useEffect(() => {
    if (!inspectorOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setInspectorOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [inspectorOpen]);

  const updateDraft = (key: keyof InspectorDraft, value: string) => {
    setDraft((current) => current ? { ...current, [key]: value } : current);
  };

  const updateTypedProperty = (field: SemanticPropertyField, input: string | boolean) => {
    setDraft((current) => {
      if (!current) return current;
      const properties = parseDraftProperties(current.properties);
      properties[field.key] = field.type === "boolean"
        ? Boolean(input)
        : field.type === "number"
          ? Number(input)
          : field.type === "list"
            ? String(input).split(",").map((item) => item.trim()).filter(Boolean)
            : input;
      return { ...current, properties: JSON.stringify(properties, null, 2) };
    });
  };

  const updateConnectionDraft = <K extends keyof ConnectionDraft>(key: K, value: ConnectionDraft[K]) => {
    setConnectionDraft((current) => current ? { ...current, [key]: value } : current);
  };

  const closeHandoff = useCallback(() => setHandoffOpen(false), []);

  const saveSemanticDetails = () => {
    if (!editor || !selectedShape || (selectedShape.type !== "geo" && selectedShape.type !== "image") || !selectedElement || !draft) return;
    try {
      const properties = JSON.parse(draft.properties || "{}");
      if (!properties || Array.isArray(properties) || typeof properties !== "object") {
        throw new Error("Custom properties must be a JSON object.");
      }
      const updated: StudioElement = {
        ...selectedElement,
        name: draft.name.trim() || "Untitled semantic object",
        type: draft.type.trim() || "concept",
        intent: draft.intent.split("\n").map((value) => value.trim()).filter(Boolean),
        implementationNotes: draft.implementationNotes.split("\n").map((value) => value.trim()).filter(Boolean),
        tags: draft.tags.split(",").map((value) => value.trim()).filter(Boolean),
        properties,
      };
      if (selectedShape.type === "geo") {
        editor.updateShape({
          id: selectedShape.id,
          type: "geo",
          props: { richText: toRichText(updated.name ?? updated.type) },
          meta: { ...selectedShape.meta, [STUDIO_META_KEY]: JSON.parse(JSON.stringify(updated)) },
        });
      } else {
        editor.updateShape({
          id: selectedShape.id,
          type: "image",
          meta: { ...selectedShape.meta, [STUDIO_META_KEY]: JSON.parse(JSON.stringify(updated)) },
        });
      }
      setMessage("Semantic details saved");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save semantic details");
    }
  };

  const saveConnectionDetails = () => {
    if (!editor || selectedShape?.type !== "arrow" || !selectedConnectionData || !connectionDraft) return;
    try {
      const properties = JSON.parse(connectionDraft.properties || "{}");
      if (!properties || Array.isArray(properties) || typeof properties !== "object") {
        throw new Error("Custom properties must be a JSON object.");
      }
      const updated: StudioConnection = {
        ...selectedConnectionData,
        label: connectionDraft.label.trim() || undefined,
        type: connectionDraft.type,
        sourceElementId: connectionDraft.sourceElementId,
        targetElementId: connectionDraft.targetElementId,
        intent: connectionDraft.intent.split("\n").map((value) => value.trim()).filter(Boolean),
        implementationNotes: connectionDraft.implementationNotes.split("\n").map((value) => value.trim()).filter(Boolean),
        tags: connectionDraft.tags.split(",").map((value) => value.trim()).filter(Boolean),
        properties,
      };
      editor.deleteBindings(editor.getBindingsFromShape(selectedShape, "arrow"));
      editor.updateShape({
        id: selectedShape.id,
        type: "arrow",
        props: { richText: toRichText(updated.label ?? "") },
        meta: { ...selectedShape.meta, [STUDIO_CONNECTION_META_KEY]: JSON.parse(JSON.stringify(updated)) },
      });
      bindArrow(editor, selectedShape.id, updated.sourceElementId, updated.targetElementId);
      setMessage("Semantic connection saved");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save semantic connection");
    }
  };

  const createSemanticConnection = () => {
    if (!editor || !selectedElement) return;
    if (!connectionSourceId) {
      setConnectionSourceId(selectedElement.id);
      setInspectorOpen(false);
      setMessage(`Connection started from ${selectedElement.name ?? selectedElement.type}. Select its destination.`);
      return;
    }
    if (connectionSourceId === selectedElement.id) {
      setConnectionSourceId(null);
      setMessage("Semantic connection cancelled");
      return;
    }
    const id = `connection-${crypto.randomUUID()}`;
    const arrowId = addConnectionToEditor(editor, {
      id,
      sourceElementId: connectionSourceId,
      targetElementId: selectedElement.id,
      type: "flow",
      properties: {},
      intent: [],
      implementationNotes: [],
      tags: [],
    });
    setConnectionSourceId(null);
    editor.select(arrowId);
    setInspectorOpen(true);
    setMessage("Semantic connection created");
  };

  const chooseReferenceImage = (locked: boolean) => {
    referenceImportLocked.current = locked;
    referenceImageInput.current?.click();
  };

  const importReferenceImage = async (file: File) => {
    if (!editor) return;
    const current = activeProjectRef.current;
    if (!current) return;
    try {
      const image = await readReferenceImage(file);
      const bounds = editor.getViewportPageBounds();
      const records = createReferenceRecords({
        file,
        src: image.src,
        imageWidth: image.width,
        imageHeight: image.height,
        canvasX: bounds.x + bounds.w * 0.08,
        canvasY: bounds.y + bounds.h * 0.08,
        canvasWidth: bounds.w * 0.84,
        canvasHeight: bounds.h * 0.84,
        locked: referenceImportLocked.current,
      });
      const updatedAt = new Date().toISOString();
      const document = parseStudioDocument({
        ...current.document,
        updatedAt,
        assets: [...current.document.assets, records.asset],
        elements: [...current.document.elements, records.element],
      });
      const updatedProject = { ...current, updatedAt, document };
      hydrating.current = true;
      try {
        addToEditor(editor, records.element, [records.asset]);
      } finally {
        hydrating.current = false;
      }
      await projectRepository.saveProject(updatedProject);
      rememberProject(updatedProject);
      if (!records.element.locked) editor.select(createShapeId(records.element.id));
      setPaletteOpen(false);
      setSaveStatus("saved");
      setMessage(records.element.locked ? "Locked reference background added" : "Reference image added");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not import that image");
    }
  };

  const toggleSelectedReferenceLock = () => {
    if (!editor || selectedShape?.type !== "image" || selectedElement?.type !== "reference-image") return;
    const locked = !selectedShape.isLocked;
    const updated: StudioElement = {
      ...selectedElement,
      locked,
      properties: { ...selectedElement.properties, role: locked ? "locked-background" : "reference" },
    };
    editor.updateShape({
      id: selectedShape.id,
      type: "image",
      isLocked: locked,
      meta: { ...selectedShape.meta, [STUDIO_META_KEY]: JSON.parse(JSON.stringify(updated)) },
    });
    if (locked) editor.sendToBack([selectedShape.id]);
    setInspectorOpen(false);
    setMessage(locked ? "Reference locked behind the design" : "Reference unlocked");
  };

  const unlockAllReferences = () => {
    if (!editor) return;
    const lockedShapes = editor.getCurrentPageShapes().filter((shape): shape is TLImageShape =>
      shape.type === "image" && shape.isLocked && (shape.meta[STUDIO_META_KEY] as StudioElement | undefined)?.type === "reference-image");
    for (const shape of lockedShapes) {
      const semantic = shape.meta[STUDIO_META_KEY] as StudioElement;
      editor.updateShape({
        id: shape.id,
        type: "image",
        isLocked: false,
        meta: { ...shape.meta, [STUDIO_META_KEY]: JSON.parse(JSON.stringify({ ...semantic, locked: false, properties: { ...semantic.properties, role: "reference" } })) },
      });
    }
    setMessage(`Unlocked ${lockedShapes.length} reference image${lockedShapes.length === 1 ? "" : "s"}`);
  };

  const createNewProject = async (name: string, mode: StudioProject["mode"]) => {
    const project = createProject(name, mode);
    await projectRepository.saveProject(project);
    rememberProject(project);
    window.history.pushState({ projectId: project.id }, "", `#project=${encodeURIComponent(project.id)}`);
  };

  const createStarterProject = async (template: StarterTemplate) => {
    const project = createProject(template.name, template.mode);
    project.document = applyStarterTemplate(project.document, template);
    project.name = project.document.name;
    project.updatedAt = project.document.updatedAt;
    await projectRepository.saveProject(project);
    rememberProject(project);
    window.history.pushState({ projectId: project.id }, "", `#project=${encodeURIComponent(project.id)}`);
  };

  const openProject = (project: StudioProject) => {
    activateProject(project);
    window.history.pushState({ projectId: project.id }, "", `#project=${encodeURIComponent(project.id)}`);
  };

  const leaveProject = () => {
    if (routedProjectId()) window.history.back();
    else window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  };

  const renameProject = (name: string) => {
    const current = activeProjectRef.current;
    if (!current) return;
    const normalized = name || "Untitled project";
    const updatedAt = new Date().toISOString();
    const updated = { ...current, name: normalized, updatedAt, document: { ...current.document, name: normalized, updatedAt } };
    rememberProject(updated);
    setSaveStatus("saving");
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void projectRepository.saveProject(updated).then(() => setSaveStatus("saved")).catch(() => setSaveStatus("error"));
    }, 450);
  };

  const saveVersion = async () => {
    const current = activeProjectRef.current;
    if (!current) return;
    const document = editor
      ? parseStudioDocument(tldrawShapesToStudioDocument(readShapes(editor), current.document, readConnections(editor)))
      : current.document;
    const versioned = snapshotProject({ ...current, document, updatedAt: document.updatedAt }, versionNote);
    await projectRepository.saveProject(versioned);
    rememberProject(versioned);
    setVersionNote("");
    setSaveStatus("saved");
    setMessage(`Saved version ${versioned.versions.at(-1)?.number}`);
  };

  const restoreVersion = async (version: ProjectVersion) => {
    const current = activeProjectRef.current;
    if (!current || !editor) return;
    const now = new Date().toISOString();
    const document = { ...structuredClone(version.document), updatedAt: now };
    const restored = { ...current, name: document.name, mode: document.mode, updatedAt: now, document };
    hydrating.current = true;
    editor.deleteShapes(Array.from(editor.getCurrentPageShapeIds()));
    document.elements.forEach((element) => addToEditor(editor, element, document.assets));
    document.connections.forEach((connection) => addConnectionToEditor(editor, connection));
    if (document.elements.length) editor.zoomToFit({ animation: { duration: 240 } });
    hydrating.current = false;
    await projectRepository.saveProject(restored);
    rememberProject(restored);
    setVersionsOpen(false);
    setMessage(`Restored version ${version.number} into the active draft`);
  };

  if (!activeProject) return <ProjectDashboard
    projects={projects}
    loading={projectsLoading}
    onCreate={(name, mode) => { void createNewProject(name, mode); }}
    onCreateStarter={(template) => { void createStarterProject(template); }}
    onOpen={openProject}
    onDuplicate={(project) => { const copy = duplicateProject(project); void projectRepository.saveProject(copy).then(() => refreshProjects()); }}
    onDelete={(project) => { if (window.confirm(`Delete ${project.name}? This cannot be undone.`)) void projectRepository.deleteProject(project.id).then(() => refreshProjects()); }}
  />;

  return <main className="studio-shell">
    <header className="studio-header">
      <div className="brand-lockup"><button className="brand-mark" aria-label="Back to projects" onClick={leaveProject}>GW</button><div><p>{activeProject.mode.replace("-", " ")}</p><input className="project-name-input" aria-label="Project name" value={activeProject.name} onChange={(event) => renameProject(event.target.value)} /></div></div>
      <div className="header-actions">
        <span className={`save-status ${saveStatus}`}>{saveStatus === "saving" ? "Saving…" : saveStatus === "error" ? "Save error" : "Saved"}</span>
        <button className="button secondary versions-button" onClick={() => { setHandoffOpen(false); setVersionsOpen((open) => !open); }}>Versions ({activeProject.versions.length})</button>
        <button className="button secondary save-version-button" onClick={() => void saveVersion()}>Save Version</button>
        <input ref={fileInput} hidden type="file" accept="application/json,.json" aria-label="Import StudioDocument JSON" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importJson(file); event.target.value = ""; }} />
        <input ref={referenceImageInput} hidden type="file" accept={REFERENCE_IMAGE_TYPES.join(",")} aria-label="Import reference image" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importReferenceImage(file); event.target.value = ""; }} />
        <button className="button secondary import-button" onClick={() => fileInput.current?.click()}>Import JSON</button>
        <button className="button primary export-button" onClick={() => void prepareHandoff()}>Handoff</button>
      </div>
    </header>
    <section className="canvas-stage" aria-label="Infinite design canvas">
      <Tldraw key={activeProject.id} onMount={onMount} licenseKey={import.meta.env.VITE_TLDRAW_LICENSE_KEY} />
      {versionsOpen ? <aside className="versions-panel" aria-label="Project versions">
        <div className="inspector-heading"><div><p>Immutable snapshots</p><h2>Version history</h2></div><button className="icon-button" aria-label="Close version history" onClick={() => setVersionsOpen(false)}>×</button></div>
        <label>Version note<input value={versionNote} placeholder="What changed?" onChange={(event) => setVersionNote(event.target.value)} /></label>
        <button className="button primary" onClick={() => void saveVersion()}>Save current version</button>
        <div className="version-list">{activeProject.versions.length === 0 ? <p>No saved versions yet.</p> : [...activeProject.versions].reverse().map((version) => <article key={version.id}>
          <div><strong>Version {version.number}</strong><span>{new Date(version.createdAt).toLocaleString()}</span>{version.note ? <p>{version.note}</p> : null}</div>
          <button className="button secondary" onClick={() => void restoreVersion(version)}>Restore</button>
        </article>)}</div>
      </aside> : null}
      {handoffOpen ? <HandoffPanel bundle={handoffBundle} error={handoffError} onClose={closeHandoff} /> : null}
      {draft && selectedElement && inspectorOpen && <aside className="semantic-inspector" aria-label="Semantic object details">
        <div className="inspector-heading">
          <div><p>Attached context</p><h2>Semantic details</h2></div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close semantic details"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => setInspectorOpen(false)}
          >×</button>
        </div>
        <label>Name<input value={draft.name} onChange={(event) => updateDraft("name", event.target.value)} /></label>
        <label>Semantic type<input value={draft.type} readOnly={selectedElement.type === "reference-image"} onChange={(event) => updateDraft("type", event.target.value)} /></label>
        {selectedPreset && <fieldset className="typed-properties">
          <legend>{selectedPreset.label} properties</legend>
          <p>{selectedPreset.description}</p>
          {selectedPropertyFields.map((field) => field.type === "boolean" ? <label className="typed-checkbox" key={field.key}>
            <span>{field.label}</span>
            <input type="checkbox" checked={Boolean(propertyInputValue(selectedProperties[field.key], field))} onChange={(event) => updateTypedProperty(field, event.target.checked)} />
          </label> : <label key={field.key}>{field.label}
            {field.type === "select" ? <select value={String(propertyInputValue(selectedProperties[field.key], field))} onChange={(event) => updateTypedProperty(field, event.target.value)}>
              {field.options?.map((option) => <option key={option} value={option}>{option.replaceAll("-", " ")}</option>)}
            </select> : field.type === "textarea" ? <textarea rows={3} value={String(propertyInputValue(selectedProperties[field.key], field))} onChange={(event) => updateTypedProperty(field, event.target.value)} />
              : <input
                type={field.type === "number" ? "number" : "text"}
                value={String(propertyInputValue(selectedProperties[field.key], field))}
                placeholder={field.type === "list" ? "Comma separated" : undefined}
                onChange={(event) => updateTypedProperty(field, event.target.value)}
              />}
          </label>)}
        </fieldset>}
        <label>Design Intent<span>Hidden from the canvas; included in JSON.</span><textarea rows={3} value={draft.intent} onChange={(event) => updateDraft("intent", event.target.value)} /></label>
        <label>Implementation Notes<span>One note per line.</span><textarea rows={3} value={draft.implementationNotes} onChange={(event) => updateDraft("implementationNotes", event.target.value)} /></label>
        <label>Tags<span>Comma separated.</span><input value={draft.tags} onChange={(event) => updateDraft("tags", event.target.value)} /></label>
        {selectedElement.type === "reference-image" ? <button type="button" className="button secondary reference-lock-toggle" onClick={toggleSelectedReferenceLock}>
          {selectedShape?.isLocked ? "Unlock reference image" : "Lock as background"}
        </button> : null}
        <details className="advanced-properties"><summary>Advanced JSON properties</summary><label>Custom properties<span>Valid JSON object.</span><textarea className="code-field" rows={6} value={draft.properties} onChange={(event) => updateDraft("properties", event.target.value)} /></label></details>
        <button className="button primary inspector-save" onClick={saveSemanticDetails}>Save attached context</button>
      </aside>}
      {connectionDraft && selectedConnectionData && inspectorOpen && <aside className="semantic-inspector" aria-label="Semantic connection details">
        <div className="inspector-heading">
          <div><p>Attached relationship</p><h2>Connection details</h2></div>
          <button type="button" className="icon-button" aria-label="Close connection details" onPointerDown={(event) => event.stopPropagation()} onClick={() => setInspectorOpen(false)}>×</button>
        </div>
        <label>Label<input value={connectionDraft.label} placeholder="Optional visible label" onChange={(event) => updateConnectionDraft("label", event.target.value)} /></label>
        <label>Relationship type<select value={connectionDraft.type} onChange={(event) => updateConnectionDraft("type", event.target.value as StudioConnection["type"])}>
          <option value="flow">Flow</option><option value="dependency">Dependency</option><option value="relationship">Relationship</option><option value="loop">Loop</option><option value="generic">Generic</option>
        </select></label>
        <label>Source<select value={connectionDraft.sourceElementId} onChange={(event) => updateConnectionDraft("sourceElementId", event.target.value)}>{readShapes(editor!).map((shape) => <option key={shape.meta[STUDIO_META_KEY].id} value={shape.meta[STUDIO_META_KEY].id}>{shape.props.label}</option>)}</select></label>
        <label>Destination<select value={connectionDraft.targetElementId} onChange={(event) => updateConnectionDraft("targetElementId", event.target.value)}>{readShapes(editor!).map((shape) => <option key={shape.meta[STUDIO_META_KEY].id} value={shape.meta[STUDIO_META_KEY].id}>{shape.props.label}</option>)}</select></label>
        <label>Design Intent<span>Hidden from the canvas; included in JSON.</span><textarea rows={3} value={connectionDraft.intent} onChange={(event) => updateConnectionDraft("intent", event.target.value)} /></label>
        <label>Implementation Notes<span>One note per line.</span><textarea rows={3} value={connectionDraft.implementationNotes} onChange={(event) => updateConnectionDraft("implementationNotes", event.target.value)} /></label>
        <label>Tags<span>Comma separated.</span><input value={connectionDraft.tags} onChange={(event) => updateConnectionDraft("tags", event.target.value)} /></label>
        <label>Custom properties<span>Valid JSON object.</span><textarea className="code-field" rows={4} value={connectionDraft.properties} onChange={(event) => updateConnectionDraft("properties", event.target.value)} /></label>
        <button className="button primary inspector-save" onClick={saveConnectionDetails}>Save connection context</button>
      </aside>}
      {paletteOpen && <aside className="semantic-palette" aria-label={`${activeProject.mode.replace("-", " ")} semantic objects`}>
        <div className="palette-heading">
          <div><p>Object library</p><h2>{activeProject.mode.replace("-", " ")} objects</h2></div>
          <button type="button" className="icon-button" aria-label="Close object library" onClick={() => setPaletteOpen(false)}>×</button>
        </div>
        <label className="auto-inspector-toggle">
          <span><strong>Open properties on selection</strong><small>Turn this off when arranging the canvas.</small></span>
          <input type="checkbox" checked={autoOpenInspector} onChange={(event) => setAutoOpenInspector(event.target.checked)} />
        </label>
        <section className="reference-import" aria-label="Reference image tools">
          <div><strong>Screenshot reference</strong><small>Embed an existing design in this project and annotate over it.</small></div>
          <div className="reference-import-buttons">
            <button type="button" onClick={() => chooseReferenceImage(false)}>Movable image</button>
            <button type="button" onClick={() => chooseReferenceImage(true)}>Locked background</button>
          </div>
          {lockedReferenceCount > 0 ? <button type="button" className="unlock-references" onClick={unlockAllReferences}>Unlock {lockedReferenceCount} background{lockedReferenceCount === 1 ? "" : "s"}</button> : null}
        </section>
        <div className="preset-grid">{semanticPresets.map((preset) => <button
          type="button"
          className="preset-button"
          key={preset.type}
          title={preset.description}
          onClick={() => addObject(preset)}
        ><span aria-hidden="true">{preset.icon}</span><strong>{preset.label}</strong><small>{preset.description}</small></button>)}</div>
      </aside>}
      <div className="semantic-actions" aria-label="Semantic object tools">
        {selectedElement && <button
          type="button"
          className={`button secondary semantic-connection-trigger${connectionSourceId ? " active" : ""}`}
          data-short={connectionSourceId ? connectionSourceId === selectedElement.id ? "×" : "→" : "→"}
          aria-label={connectionSourceId
            ? connectionSourceId === selectedElement.id ? "Cancel semantic connection" : "Connect to selected semantic object"
            : "Start semantic connection from selected object"}
          onClick={createSemanticConnection}
        ><span aria-hidden="true">→</span> {connectionSourceId
          ? connectionSourceId === selectedElement.id ? "Cancel connection" : "Connect here"
          : "Connect"}</button>}
        {hasSemanticSelection && <button
          type="button"
          className={`button secondary semantic-context-trigger${inspectorOpen ? " active" : ""}`}
          data-short="✦"
          aria-label={inspectorOpen ? "Close attached semantic context" : "Edit attached semantic context"}
          aria-expanded={inspectorOpen}
          aria-pressed={inspectorOpen}
          onClick={() => setInspectorOpen((open) => !open)}
        ><span aria-hidden="true">✦</span> {inspectorOpen ? "Hide context" : "Edit context"}</button>}
        <button
          type="button"
          className={`button primary add-object${paletteOpen ? " active" : ""}`}
          data-short={paletteOpen ? "×" : "+"}
          aria-expanded={paletteOpen}
          aria-label={paletteOpen ? "Close semantic object library" : "Open semantic object library"}
          onClick={() => setPaletteOpen((open) => !open)}
        >{paletteOpen ? "× Close objects" : "＋ Add object"}</button>
      </div>
    </section>
    <footer aria-live="polite"><span><strong>{count}</strong> semantic object{count === 1 ? "" : "s"}</span><span>{message}</span><span>StudioDocument v1 · r{revision}</span></footer>
  </main>;
}
