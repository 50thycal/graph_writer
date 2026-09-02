import { useCallback, useEffect, useRef, useState } from "react";
import { createShapeId, getArrowBindings, type Editor, type TLArrowShape, Tldraw } from "tldraw";
import { toRichText } from "@tldraw/tlschema";
import { STUDIO_CONNECTION_META_KEY, STUDIO_META_KEY, studioConnectionToTldrawConnection, studioElementToTldrawShape, tldrawShapesToStudioDocument, type TldrawConnectionRecord, type TldrawShapeRecord } from "./canvas/adapter/studio-tldraw-adapter";
import { createStudioDocument, parseStudioDocument, type StudioConnection, type StudioElement } from "./studio/schema/studio-document";

const seedElement: StudioElement = {
  id: "concept-1", type: "concept", name: "Structured idea",
  transform: { x: 120, y: 120, width: 260, height: 150 },
  properties: { status: "draft" },
  intent: ["Every visual object keeps clean semantic metadata."],
  implementationNotes: ["Rendered by tldraw; owned by StudioDocument."], tags: ["foundation"],
};

const basis = createStudioDocument({
  id: "foundation-proof", name: "StudioDocument boundary proof", mode: "blank",
  description: "WS-001 / WS-002 architectural proof", elements: [seedElement],
});

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
  const [editor, setEditor] = useState<Editor | null>(null);
  const [revision, setRevision] = useState(0);
  const [message, setMessage] = useState("Schema v1 ready");
  const [draft, setDraft] = useState<InspectorDraft | null>(null);
  const [connectionDraft, setConnectionDraft] = useState<ConnectionDraft | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // Selection lives in tldraw's session state, so listen to the whole store.
  // A document-only listener misses select() calls made immediately after creating a shape.
  useEffect(() => editor?.store.listen(() => setRevision((value) => value + 1), { scope: "all" }), [editor]);

  const onMount = useCallback((instance: Editor) => {
    setEditor(instance);
    if (!instance.getCurrentPageShapes().length) {
      basis.elements.forEach((element) => addToEditor(instance, element));
      instance.zoomToFit({ animation: { duration: 240 } });
    }
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
    const document = parseStudioDocument(tldrawShapesToStudioDocument(readShapes(editor), basis, readConnections(editor)));
    const url = URL.createObjectURL(new Blob([JSON.stringify(document, null, 2)], { type: "application/json" }));
    const link = window.document.createElement("a");
    link.href = url; link.download = "studio-document.json"; link.click(); URL.revokeObjectURL(url);
    setMessage("Clean StudioDocument exported");
  };

  const importJson = async (file: File) => {
    if (!editor) return;
    try {
      const document = parseStudioDocument(JSON.parse(await file.text()));
      editor.deleteShapes(Array.from(editor.getCurrentPageShapeIds()));
      document.elements.forEach((element) => addToEditor(editor, element));
      document.connections.forEach((connection) => addConnectionToEditor(editor, connection));
      editor.zoomToFit({ animation: { duration: 240 } });
      setMessage(`Imported ${document.elements.length} semantic objects`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import failed");
    }
  };

  const count = editor ? readShapes(editor).length : basis.elements.length;
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

  return <main className="studio-shell">
    <header className="studio-header">
      <div className="brand-lockup"><span className="brand-mark">GW</span><div><p>Design Studio</p><h1>Foundation proof</h1></div></div>
      <div className="header-actions">
        <input ref={fileInput} hidden type="file" accept="application/json,.json" aria-label="Import StudioDocument JSON" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importJson(file); event.target.value = ""; }} />
        <button className="button secondary" onClick={() => fileInput.current?.click()}>Import JSON</button>
        <button className="button primary" onClick={exportJson}>Export JSON</button>
      </div>
    </header>
    <section className="canvas-stage" aria-label="Infinite design canvas">
      <Tldraw onMount={onMount} licenseKey={import.meta.env.VITE_TLDRAW_LICENSE_KEY} persistenceKey="graph-writer-ws-002" />
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
