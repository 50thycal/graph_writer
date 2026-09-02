import { useCallback, useEffect, useRef, useState } from "react";
import { createShapeId, getArrowBindings, type Editor, type TLArrowShape, Tldraw } from "tldraw";
import { toRichText } from "@tldraw/tlschema";
import { STUDIO_CONNECTION_META_KEY, STUDIO_META_KEY, studioConnectionToTldrawConnection, studioElementToTldrawShape, tldrawShapesToStudioDocument, type TldrawConnectionRecord, type TldrawShapeRecord } from "./canvas/adapter/studio-tldraw-adapter";
import { parseStudioDocument, type StudioConnection, type StudioElement } from "./studio/schema/studio-document";
import { ProjectDashboard } from "./features/projects/ProjectDashboard";
import { IndexedDbProjectRepository, createProject, duplicateProject, snapshotProject, type ProjectVersion, type StudioProject } from "./features/projects/project-repository";

const projectRepository = new IndexedDbProjectRepository();

function addToEditor(editor: Editor, element: StudioElement) {
  const record = studioElementToTldrawShape(element);
  editor.createShape({
    id: createShapeId(element.id), type: "geo", x: record.x, y: record.y, rotation: record.rotation,
    isLocked: element.locked,
    props: { w: record.props.w, h: record.props.h, geo: "rectangle", fill: "solid", color: "blue", size: "m", richText: toRichText(record.props.label) },
    meta: { [STUDIO_META_KEY]: JSON.parse(JSON.stringify(record.meta[STUDIO_META_KEY])) },
  });
}

function readShapes(editor: Editor): TldrawShapeRecord[] {
  return editor.getCurrentPageShapes()
    .filter((shape) => shape.type === "geo" && shape.meta[STUDIO_META_KEY])
    .map((shape) => ({
      id: shape.id, type: "geo" as const, x: shape.x, y: shape.y, rotation: shape.rotation,
      props: {
        w: (shape.props as { w: number }).w,
        h: (shape.props as { h: number }).h,
        label: editor.getShapeUtil(shape).getText(shape)?.trim() || (shape.meta[STUDIO_META_KEY] as StudioElement).name || "Semantic object",
      },
      meta: {
        [STUDIO_META_KEY]: {
          ...(shape.meta[STUDIO_META_KEY] as StudioElement),
          name: editor.getShapeUtil(shape).getText(shape)?.trim() || (shape.meta[STUDIO_META_KEY] as StudioElement).name,
        },
      },
    }));
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
  const [versionNote, setVersionNote] = useState("");
  const [saveStatus, setSaveStatus] = useState<"saving" | "saved" | "error">("saved");
  const fileInput = useRef<HTMLInputElement>(null);
  const activeProjectRef = useRef<StudioProject | null>(null);
  const saveTimer = useRef<number | undefined>(undefined);
  const hydrating = useRef(false);

  const refreshProjects = useCallback(async () => {
    try {
      setProjects(await projectRepository.listProjects());
    } finally {
      setProjectsLoading(false);
    }
  }, []);

  useEffect(() => { void refreshProjects(); }, [refreshProjects]);

  const rememberProject = useCallback((project: StudioProject) => {
    activeProjectRef.current = project;
    setActiveProject(project);
    setProjects((current) => [project, ...current.filter((item) => item.id !== project.id)]
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)));
  }, []);

  // Selection lives in tldraw's session state, so listen to the whole store.
  // A document-only listener misses select() calls made immediately after creating a shape.
  useEffect(() => editor?.store.listen(() => setRevision((value) => value + 1), { scope: "all" }), [editor]);

  useEffect(() => {
    if (!editor || !activeProject) return;
    return editor.store.listen(() => {
      if (hydrating.current) return;
      window.clearTimeout(saveTimer.current);
      setSaveStatus("saving");
      saveTimer.current = window.setTimeout(() => {
        const current = activeProjectRef.current;
        if (!current) return;
        const document = parseStudioDocument(tldrawShapesToStudioDocument(readShapes(editor), current.document, readConnections(editor)));
        const updated = { ...current, name: document.name, mode: document.mode, updatedAt: document.updatedAt, document };
        void projectRepository.saveProject(updated)
          .then(() => { rememberProject(updated); setSaveStatus("saved"); })
          .catch(() => setSaveStatus("error"));
      }, 450);
    }, { scope: "document" });
  }, [activeProject?.id, editor, rememberProject]);

  const onMount = useCallback((instance: Editor) => {
    setEditor(instance);
    const project = activeProjectRef.current;
    if (!project) return;
    hydrating.current = true;
    if (instance.getCurrentPageShapes().length) instance.deleteShapes(Array.from(instance.getCurrentPageShapeIds()));
    project.document.elements.forEach((element) => addToEditor(instance, element));
    project.document.connections.forEach((connection) => addConnectionToEditor(instance, connection));
    if (project.document.elements.length) instance.zoomToFit({ animation: { duration: 240 } });
    hydrating.current = false;
  }, []);

  const addObject = () => {
    if (!editor) return;
    const id = `concept-${crypto.randomUUID()}`;
    const center = editor.getViewportPageBounds().center;
    addToEditor(editor, { id, type: "concept", name: "New semantic object", transform: { x: center.x - 120, y: center.y - 70, width: 240, height: 140 }, properties: { status: "draft" }, intent: ["Describe the purpose of this object."], tags: ["concept"] });
    editor.select(createShapeId(id));
    setMessage("Semantic object added");
  };

  const exportJson = () => {
    if (!editor) return;
    const connections = readConnections(editor);
    const arrowCount = editor.getCurrentPageShapes().filter((shape) => shape.type === "arrow").length;
    const current = activeProjectRef.current;
    if (!current) return;
    const document = parseStudioDocument(tldrawShapesToStudioDocument(readShapes(editor), current.document, connections));
    const url = URL.createObjectURL(new Blob([JSON.stringify(document, null, 2)], { type: "application/json" }));
    const link = window.document.createElement("a");
    link.href = url; link.download = "studio-document.json"; link.click(); URL.revokeObjectURL(url);
    const looseArrowCount = arrowCount - connections.length;
    setMessage(looseArrowCount > 0
      ? `Exported ${connections.length} semantic connection${connections.length === 1 ? "" : "s"}; skipped ${looseArrowCount} loose arrow${looseArrowCount === 1 ? "" : "s"}`
      : `Exported ${connections.length} semantic connection${connections.length === 1 ? "" : "s"}`);
  };

  const importJson = async (file: File) => {
    if (!editor) return;
    try {
      const document = parseStudioDocument(JSON.parse(await file.text()));
      const current = activeProjectRef.current;
      if (!current) return;
      hydrating.current = true;
      editor.deleteShapes(Array.from(editor.getCurrentPageShapeIds()));
      document.elements.forEach((element) => addToEditor(editor, element));
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

  useEffect(() => {
    setDraft(selectedElement ? elementToDraft(selectedElement) : null);
    setConnectionDraft(selectedConnectionData ? connectionToDraft(selectedConnectionData) : null);
    setInspectorOpen(hasSemanticSelection);
  }, [selectedShape?.id]);

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

  const updateConnectionDraft = <K extends keyof ConnectionDraft>(key: K, value: ConnectionDraft[K]) => {
    setConnectionDraft((current) => current ? { ...current, [key]: value } : current);
  };

  const saveSemanticDetails = () => {
    if (!editor || !selectedShape || selectedShape.type !== "geo" || !selectedElement || !draft) return;
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
      editor.updateShape({
        id: selectedShape.id,
        type: "geo",
        props: { richText: toRichText(updated.name ?? updated.type) },
        meta: { ...selectedShape.meta, [STUDIO_META_KEY]: JSON.parse(JSON.stringify(updated)) },
      });
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

  const createNewProject = async (name: string, mode: StudioProject["mode"]) => {
    const project = createProject(name, mode);
    await projectRepository.saveProject(project);
    rememberProject(project);
  };

  const openProject = (project: StudioProject) => {
    activeProjectRef.current = structuredClone(project);
    setActiveProject(structuredClone(project));
    setEditor(null);
    setInspectorOpen(false);
    setVersionsOpen(false);
  };

  const leaveProject = () => {
    window.clearTimeout(saveTimer.current);
    activeProjectRef.current = null;
    setActiveProject(null);
    setEditor(null);
    setInspectorOpen(false);
    setVersionsOpen(false);
    void refreshProjects();
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
    document.elements.forEach((element) => addToEditor(editor, element));
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
    onOpen={openProject}
    onDuplicate={(project) => { const copy = duplicateProject(project); void projectRepository.saveProject(copy).then(() => refreshProjects()); }}
    onDelete={(project) => { if (window.confirm(`Delete ${project.name}? This cannot be undone.`)) void projectRepository.deleteProject(project.id).then(() => refreshProjects()); }}
  />;

  return <main className="studio-shell">
    <header className="studio-header">
      <div className="brand-lockup"><button className="brand-mark" aria-label="Back to projects" onClick={leaveProject}>GW</button><div><p>{activeProject.mode.replace("-", " ")}</p><input className="project-name-input" aria-label="Project name" value={activeProject.name} onChange={(event) => renameProject(event.target.value)} /></div></div>
      <div className="header-actions">
        <span className={`save-status ${saveStatus}`}>{saveStatus === "saving" ? "Saving…" : saveStatus === "error" ? "Save error" : "Saved"}</span>
        <button className="button secondary" onClick={() => setVersionsOpen((open) => !open)}>Versions ({activeProject.versions.length})</button>
        <button className="button secondary" onClick={() => void saveVersion()}>Save Version</button>
        <input ref={fileInput} hidden type="file" accept="application/json,.json" aria-label="Import StudioDocument JSON" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importJson(file); event.target.value = ""; }} />
        <button className="button secondary" onClick={() => fileInput.current?.click()}>Import JSON</button>
        <button className="button primary" onClick={exportJson}>Export JSON</button>
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
        <label>Semantic type<input value={draft.type} onChange={(event) => updateDraft("type", event.target.value)} /></label>
        <label>Design Intent<span>Hidden from the canvas; included in JSON.</span><textarea rows={3} value={draft.intent} onChange={(event) => updateDraft("intent", event.target.value)} /></label>
        <label>Implementation Notes<span>One note per line.</span><textarea rows={3} value={draft.implementationNotes} onChange={(event) => updateDraft("implementationNotes", event.target.value)} /></label>
        <label>Tags<span>Comma separated.</span><input value={draft.tags} onChange={(event) => updateDraft("tags", event.target.value)} /></label>
        <label>Custom properties<span>Valid JSON object.</span><textarea className="code-field" rows={4} value={draft.properties} onChange={(event) => updateDraft("properties", event.target.value)} /></label>
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
      <div className="canvas-callout" aria-live="polite"><span className="pulse-dot" /><strong>{count}</strong> semantic object{count === 1 ? "" : "s"}<i />{message}</div>
      <div className="semantic-actions" aria-label="Semantic object tools">
        {selectedElement && <button
          type="button"
          className={`button secondary semantic-connection-trigger${connectionSourceId ? " active" : ""}`}
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
          aria-label={inspectorOpen ? "Close attached semantic context" : "Edit attached semantic context"}
          aria-expanded={inspectorOpen}
          aria-pressed={inspectorOpen}
          onClick={() => setInspectorOpen((open) => !open)}
        ><span aria-hidden="true">✦</span> {inspectorOpen ? "Hide context" : "Edit context"}</button>}
        <button className="button primary add-object" onClick={addObject}>＋ Semantic object</button>
      </div>
    </section>
    <footer><span>StudioDocument v1</span><span>tldraw behind adapter</span><span>WS-001 · WS-002 · r{revision}</span></footer>
  </main>;
}
