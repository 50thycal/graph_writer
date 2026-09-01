# Graph Writer / Design Studio — v0.1 Product & Build Specification

**Repository:** `50thycal/graph_writer`  
**Product name:** Design Studio  
**Status:** Approved initial plan  
**Initial implementation scope:** WS-001 and WS-002 only

## 1. Product vision

Build a mobile-first infinite-canvas Design Studio for visually designing AI workflows, software systems, board games, interfaces, and other structured artifacts.

The core workflow is:

> Think visually → annotate intent → export structured design → hand off to Claude/Codex → implement

The canvas is the human interface. A versioned `StudioDocument` JSON model is the machine interface. The product must preserve spatial, semantic, and implementation intent without requiring the user to restate a complex design entirely in prose.

## 2. Architectural decisions

These decisions are approved and should be treated as constraints:

1. Use the tldraw SDK as the canvas engine.
2. `StudioDocument` is the canonical durable data model.
3. Raw tldraw records are not the public export or long-lived application contract.
4. Keep tldraw-specific behavior behind a canvas adapter wherever practical.
5. Author and export Graph Looper graphs before adding execution.
6. Support both structured JSON import and screenshot-as-reference redesign.
7. Use autosaved working state plus immutable named version snapshots.
8. Design every feature for touch/mobile use from the beginning.
9. Make AI handoff a first-class workflow.
10. Do not expand v0.1 into a Figma replacement.
11. Do not encode Subway-specific rules or other project-specific rules in the generic canvas core.
12. Graphs may contain cycles.

Architecture:

```text
StudioDocument
      │
      ▼
Canvas Adapter
      │
      ▼
tldraw
```

This boundary must be proven before specialized modes are built.

## 3. Primary use cases

### 3.1 Graph Looper and AI workflows

Author directed graphs containing:

- Input
- Agent
- Tool
- Transform
- Gate
- Human checkpoint
- Output
- Generic node

Nodes carry structured properties such as role, model, inputs, outputs, tools, and retry behavior. Edges may represent flow, dependency, relationship, or loops. v0.1 authors and exports graphs; it does not execute them.

### 3.2 Board-game design

Create arbitrary tabletop layouts containing:

- Boards
- Cards
- Decks
- Tokens
- Player areas
- Tracks
- Panels
- Frames
- Text
- Images
- Notes
- Arrows and connections

A visual object must optionally carry semantic data. A card is not merely a rectangle; it can include category, title, rules text, point value, tags, design intent, and implementation notes.

The user must be able to import an existing screenshot, lock it as a background/reference, redesign over it, and export both the new spatial arrangement and the attached intent.

### 3.3 UI and application concepts

Provide lightweight conceptual mockup objects:

- Screen
- Container
- Panel
- Card
- Button
- Input
- Text
- Image
- Modal
- Navigation

The goal is enough fidelity to communicate layout, hierarchy, behavior, relationships, and implementation intent to a coding agent. It is not a replacement for full-fidelity interface design software.

### 3.4 General concept mapping

Provide an unrestricted whiteboard using rectangles, ellipses, text, images, freehand drawing, notes, arrows, lines, frames, and groups.

## 4. Product principles

### Mobile first

The application must work comfortably on an iPhone without hover or desktop-only actions.

Support:

- Pinch to zoom
- Touch pan
- Tap to select
- Drag and resize
- Touch-sized handles and controls
- Long-press contextual actions
- Easy connector creation
- Mobile bottom-sheet property editing
- Safe-area awareness
- Large toolbar targets

Desktop shortcuts are useful but secondary. Essential capabilities must remain available on mobile.

### Canvas plus semantics

Every meaningful element may contain:

- Visual representation
- Structured properties
- Design intent
- Implementation notes
- Tags and relationships

This semantic layer is the primary product differentiation from a normal whiteboard.

### First-class AI handoff

A prominent Handoff action must produce:

1. A PNG rendering
2. Clean semantic `StudioDocument` JSON
3. A deterministic Markdown implementation brief

The screenshot communicates spatial intent; JSON communicates semantic intent; Markdown prioritizes the requested changes.

## 5. Technology

Use:

- React
- TypeScript with strict mode
- Vite
- tldraw SDK
- Mobile-first responsive CSS
- Vercel-compatible deployment
- IndexedDB for v0.1 local persistence

Avoid unnecessary framework complexity.

Support `VITE_TLDRAW_LICENSE_KEY` for production deployment. The license key may be client-visible as intended by tldraw, but other secrets must not enter the frontend bundle. Keep license-dependent code within the canvas layer.

## 6. Canonical document model

Every persisted document must include `schemaVersion`. Create migration infrastructure from the beginning, even when only version 1 exists.

```ts
interface StudioDocument {
  schemaVersion: number
  id: string
  name: string
  description?: string
  mode: "blank" | "graph" | "board-game" | "ui" | "architecture"
  createdAt: string
  updatedAt: string
  elements: StudioElement[]
  connections: StudioConnection[]
  groups: StudioGroup[]
  assets: StudioAsset[]
  metadata: Record<string, unknown>
}

interface StudioElement {
  id: string
  type: string
  subtype?: string
  name?: string
  transform: {
    x: number
    y: number
    width: number
    height: number
    rotation?: number
    zIndex?: number
  }
  appearance?: Record<string, unknown>
  content?: Record<string, unknown>
  properties?: Record<string, unknown>
  intent?: string[]
  implementationNotes?: string[]
  tags?: string[]
  locked?: boolean
}

interface StudioConnection {
  id: string
  sourceElementId: string
  targetElementId: string
  type: "flow" | "dependency" | "relationship" | "loop" | "generic"
  label?: string
  properties?: Record<string, unknown>
}
```

The exact schema may evolve during WS-002, but its engine independence and semantic coverage may not be weakened.

## 7. Suggested source boundaries

```text
src/
  studio/
    schema/
    model/
    migrations/
  canvas/
    adapter/
    shapes/
    bindings/
  features/
    projects/
    inspector/
    export/
    import/
    templates/
```

The adapter owns:

- `StudioDocument → tldraw representation`
- `tldraw changes → StudioDocument updates`

Do not scatter tldraw record handling throughout feature code. Avoid duplicating full canvas snapshots into React state during pointer movement.

## 8. Inspector and Design Intent

Selecting an element opens:

- A right-side inspector on desktop
- A bottom sheet on mobile

Common fields:

- Name
- Object type
- Tags
- Design Intent
- Implementation notes
- Custom key/value properties
- Lock/unlock
- Duplicate
- Delete

Type-specific fields may be layered on top.

Design Intent is semantic metadata, not necessarily visible canvas text. A visible indicator should show when an object has attached intent or notes.

Example:

> Make this panel read as part of the tabletop rather than as a separate webpage card.

## 9. Projects, persistence, and versions

The landing screen lists projects with name, mode, thumbnail, last-edited time, and current version.

Actions:

- Open
- Duplicate
- Rename
- Delete
- Export

For v0.1:

- Persist projects reliably in IndexedDB.
- Autosave mutations with sensible debouncing.
- Show Saving, Saved, and Error states without interrupting editing.
- Maintain an autosaved active workspace.
- Allow explicit immutable snapshots through Save Version.
- Store timestamp, optional note, document snapshot, and optional thumbnail.
- Do not build branching or multiplayer collaboration.

Keep persistence behind a replaceable `ProjectRepository` interface so cloud sync can be added later.

## 10. Import

Support:

### StudioDocument JSON file

Validate the schema and document version before loading. Show actionable errors.

### Pasted StudioDocument JSON

Allow direct paste into an import modal.

### Screenshot or image

Allow an image to be uploaded as a movable/resizable object or a lockable reference background. This is a core board-game and UI-redesign workflow.

Screenshot-to-structured-layout AI is deferred.

## 11. Export and handoff

The Handoff workflow must support:

### PNG

Export the whole design, current frame, or current selection. The default should fit designed content intelligently.

### Semantic JSON

Export clean `StudioDocument` data without irrelevant tldraw internals.

### Markdown brief

Generate deterministic Markdown that includes:

- Project and version
- Objective, when present
- Elements with Design Intent
- Implementation notes
- Relevant relationships
- Exported filenames

### Copy Handoff

On mobile, copy an AI-ready package containing the Markdown brief and semantic JSON without requiring manual selection of large text. Use the native share sheet for the screenshot where browser support permits.

## 12. Templates and modes

New Project offers:

- Blank Canvas
- Graph / Graph Looper
- Board Game
- UI / App
- Architecture

Templates configure tools, initial objects, and defaults. They must share the same `StudioDocument` model and application core.

## 13. Graph validation

v0.1 validation detects:

- Duplicate IDs
- Connections with missing source
- Connections with missing destination
- Dangling connections

Do not enforce DAG behavior; cycles are valid.

## 14. Error handling and recovery

Never silently discard:

- Invalid imports
- Unsupported document versions
- Failed persistence
- Failed exports

Prefer recoverable errors and preserve local copies whenever possible.

## 15. Testing

At minimum, automate tests for:

### Schema

- Serialization
- Deserialization
- Validation
- Migrations

### Canvas adapter

- Studio to canvas
- Canvas to Studio
- Geometry preservation
- Semantic metadata preservation
- Connection preservation

### Persistence

- Save and restore
- Autosaved workspace
- Version snapshots

### Export

- Deterministic JSON
- Deterministic Markdown

### Graph validation

- Valid graph
- Valid loop
- Dangling edge
- Missing node

Add lightweight end-to-end coverage for:

1. Create a project.
2. Create and connect several elements.
3. Add Design Intent.
4. Reload and verify persistence.
5. Export a handoff.

## 16. Performance and accessibility

Target smooth manipulation of several hundred ordinary elements on a modern phone.

Maintain clear boundaries between:

- Canvas transient state
- Persisted document state
- Application UI state

Use accessible controls outside the canvas, including meaningful labels, keyboard navigation, sufficient contrast, and touch target sizing.

## 17. v0.1 non-goals

Do not build yet:

- Multiplayer collaboration
- Multi-user comments
- Graph Looper execution
- AI-generated designs
- Screenshot-to-layout AI
- Automated code generation
- GitHub synchronization
- Build OS integration
- Visual version diffs
- Advanced vector editing
- Animation editing
- Board-game simulation
- A complete design system

## 18. Acceptance scenarios

### Graph workflow

From an iPhone:

1. Create a Graph project.
2. Add Input, Agent, Gate, and another Agent.
3. Connect the nodes.
4. Add an edge back to an earlier node.
5. Add structured properties and Design Intent.
6. Refresh the browser and retain the design.
7. Export a usable PNG, semantic JSON, and Markdown brief.

Pass only if no desktop-only interaction is required.

### Board-game redesign

1. Create a Board Game project.
2. Import and lock an existing screenshot.
3. Place structured Card and Panel objects around it.
4. Rearrange the proposed design.
5. Attach Design Intent.
6. Save an immutable named version.
7. Export the handoff.

Pass if a coding agent receives enough spatial and semantic information to implement the redesign without the user rewriting the whole layout in prose.

### Portability

1. Export a project as `StudioDocument` JSON.
2. Remove the local project.
3. Import the JSON.
4. Recover visual placement, relationships, content, properties, intent, and implementation notes.

This round trip is a hard architectural acceptance criterion.

## 19. Workstreams

### WS-001 — Foundation

Deliver:

- React/Vite/TypeScript setup
- Vercel-ready build
- tldraw integration
- Mobile application shell
- Lint and test tooling

Exit condition: the infinite canvas works locally at desktop and mobile viewport sizes.

### WS-002 — StudioDocument boundary

Deliver:

- Canonical versioned schema
- Validation
- Migration infrastructure
- Canvas adapter
- Basic generic semantic element
- JSON import/export sufficient to prove a round trip
- Focused adapter and schema tests

Exit condition: a `StudioDocument` can render to the canvas, be manipulated through tldraw, and return to a clean `StudioDocument` without semantic loss.

### WS-003 — Projects and persistence

Project list, IndexedDB, autosave, and named snapshots.

### WS-004 — Semantic inspector

Common metadata, custom properties, Design Intent, implementation notes, and mobile bottom sheet.

### WS-005 — Specialized modes

Graph, Board Game, UI, and Architecture objects/templates, all using the common model.

### WS-006 — Import and reference design

JSON upload/paste, image upload, lockable reference background, validation, and recoverable errors.

### WS-007 — AI handoff

PNG, semantic JSON, deterministic Markdown, Copy Handoff, and native mobile sharing where supported.

### WS-008 — Hardening

Mobile usability audit, recovery, performance, accessibility, documentation, deployment guidance, and complete acceptance testing.

## 20. First build objective

Implement WS-001 and WS-002 only in the first build.

The first milestone must demonstrate:

```text
Mobile-friendly tldraw canvas
        +
StudioDocument
        +
Canvas adapter
        +
Basic semantic object
        +
JSON round trip
```

The review gate is:

> Can a user manipulate objects naturally through tldraw while Design Studio retains a clean, stable, engine-independent semantic representation?

Do not begin the later workstreams until that boundary is demonstrated and reviewed.

## 21. Future direction

Likely sequence after v0.1:

- v0.2: Cloud sync, Mac/iPhone continuity, read-only links, improved history
- v0.3: Graph Looper adapters, YAML generation, schema validation, optional execution integration
- v0.4: Natural-language editing and screenshot/repository UI structuring
- v0.5: Build OS artifact tracking from design intent through implementation and verification

Long-term loop:

```text
Design Intent
    ↓
StudioDocument
    ↓
Claude / Codex
    ↓
Implementation PR
    ↓
Verification
    ↓
Updated design
```
