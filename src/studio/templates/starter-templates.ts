import type { StudioConnection, StudioDocument, StudioElement } from "../schema/studio-document";

export interface StarterTemplate {
  id: string;
  name: string;
  shortName: string;
  description: string;
  complexity: "simple" | "intermediate" | "multi-level";
  mode: StudioDocument["mode"];
  elements: StudioElement[];
  connections: StudioConnection[];
}

const element = (
  id: string,
  type: string,
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
  properties: Record<string, unknown>,
  appearance: Record<string, unknown>,
  intent: string[],
  parentElementId?: string,
): StudioElement => ({ id, type, name, transform: { x, y, width, height }, properties, appearance, intent, implementationNotes: [], tags: [type, "starter"], ...(parentElementId ? { parentElementId } : {}) });

const flow = (id: string, sourceElementId: string, targetElementId: string, label: string, intent: string, type: StudioConnection["type"] = "flow"): StudioConnection =>
  ({ id, sourceElementId, targetElementId, type, label, properties: {}, intent: [intent], implementationNotes: [], tags: [] });

// Root level: the core loop, small enough to agree on in one glance.
// Each root object then zooms into its own level, so the risky chunk can be built and verified on its own.
const radioElements: StudioElement[] = [
  element("radio-user", "input", "You, in any chat", 0, 150, 190, 110, { dataType: "spoken or typed request", required: true }, { shape: "oval", color: "green", fill: "solid" }, ["Lowest friction wins: no dedicated project folder, no app to open."]),
  element("radio-skill", "agent", "Radio skill", 300, 130, 250, 150, { role: "editorial rules", model: "", inputs: ["request", "repo evidence"], outputs: ["feed", "topics", "script"], tools: ["github"], retryCount: 0 }, { shape: "rectangle", color: "violet", fill: "solid" }, ["The only custom component. Zoom in for the three modes.", "It selects and narrates; it never becomes a second source of truth."]),
  element("radio-github", "tool", "GitHub", 300, 400, 250, 130, { toolName: "github connector", operation: "read repos, PRs, docs" }, { shape: "hexagon", color: "orange", fill: "solid" }, ["Hard part first: prove this connection works before polishing any output.", "Zoom in for what it is and is not used for."]),
  element("radio-memory", "concept", "Stable preferences", 0, 400, 190, 130, { status: "ready" }, { shape: "rectangle", color: "blue", fill: "solid" }, ["Chat memory holds who you are and how you like to listen, never current project status."]),
  element("radio-output", "output", "Update or episode", 790, 150, 220, 110, { dataType: "listenable text", destination: "chat, then voice" }, { shape: "oval", color: "green", fill: "solid" }, ["Text stays visible for checking; voice reads it back.", "Listening leads to the next question in the same chat, so the loop closes without another tool."]),
  // Level: Radio skill
  element("radio-mode-catchup", "transform", "Catch me up", 0, 0, 230, 130, { inputSchema: "window of repo activity", outputSchema: "compact feed" }, { shape: "rectangle", color: "blue", fill: "solid" }, ["Surface what changed, what was verified, what needs a decision. Do not invent new work."], "radio-skill"),
  element("radio-mode-suggest", "transform", "Suggest episodes", 0, 190, 230, 130, { inputSchema: "recent tensions and decisions", outputSchema: "three topics" }, { shape: "rectangle", color: "blue", fill: "solid" }, ["Favour unresolved decisions over summaries."], "radio-skill"),
  element("radio-mode-podcast", "transform", "Make a podcast", 0, 380, 230, 130, { inputSchema: "one topic", outputSchema: "listening script" }, { shape: "rectangle", color: "blue", fill: "solid" }, ["Evidence brief first, narration second, so it never reads like a changelog."], "radio-skill"),
  element("radio-evidence", "agent", "Evidence brief", 340, 190, 240, 140, { role: "researcher", model: "", inputs: ["repo activity"], outputs: ["facts", "open questions", "confidence"], tools: ["github"], retryCount: 1 }, { shape: "rectangle", color: "violet", fill: "solid" }, ["Shared by all three modes; separates facts from interpretation."], "radio-skill"),
  element("radio-gate", "gate", "Meaningful?", 680, 170, 180, 180, { condition: "changes behaviour, closes or opens a decision", truePath: "include", falsePath: "ignore" }, { shape: "diamond", color: "yellow", fill: "solid" }, ["Dependency bumps and formatting never make the cut."], "radio-skill"),
  // Level: GitHub
  element("radio-live", "concept", "Live evidence", 0, 0, 260, 140, { status: "active" }, { shape: "rectangle", color: "orange", fill: "solid" }, ["Commits, PRs, issues, tests: read on demand, never cached into a second feed."], "radio-github"),
  element("radio-durable", "concept", "Durable intent", 0, 200, 260, 140, { status: "draft" }, { shape: "rectangle", color: "orange", fill: "solid" }, ["One short project-state document per repo: why it exists, current goal, definition of done.", "Changes only when direction changes, so it is not a changelog."], "radio-github"),
  element("radio-registry", "note", "Tiny registry", 340, 100, 220, 120, { audience: "implementation" }, { shape: "cloud", color: "yellow", fill: "solid" }, ["Friendly names and which monorepo folder is which game. Nothing that changes weekly."], "radio-github"),
];

const radioConnections: StudioConnection[] = [
  flow("radio-ask", "radio-user", "radio-skill", "asks", "Natural phrasing triggers the skill; an explicit mention guarantees it."),
  flow("radio-read", "radio-skill", "radio-github", "reads", "Every answer is grounded in current repo evidence.", "dependency"),
  flow("radio-prefs", "radio-memory", "radio-skill", "shapes tone", "Preferences shape length and voice, not facts.", "relationship"),
  flow("radio-deliver", "radio-skill", "radio-output", "produces", "One of three outputs depending on the request."),
  flow("radio-catchup-evidence", "radio-mode-catchup", "radio-evidence", "needs", "Feed is built from the brief, not from raw commits.", "dependency"),
  flow("radio-suggest-evidence", "radio-mode-suggest", "radio-evidence", "needs", "Topics come from tensions the brief exposes.", "dependency"),
  flow("radio-podcast-evidence", "radio-mode-podcast", "radio-evidence", "needs", "Script is written only after the brief is fact-checked.", "dependency"),
  flow("radio-evidence-gate", "radio-evidence", "radio-gate", "filters", "The gate keeps the feed short enough to read on a phone."),
  flow("radio-live-durable", "radio-live", "radio-durable", "compared against", "Live activity is judged against the stated goal, so drift is visible.", "relationship"),
];

const colorMatchElements: StudioElement[] = [
  element("color-table", "board", "Shared Tabletop", 0, 0, 960, 600, { dimensions: "960 × 600", zones: ["draw", "discard", "players"] }, { shape: "rectangle", color: "green", fill: "semi" }, ["Keep the central play state immediately readable on a phone."]),
  element("color-rules", "rule", "Turn Rules", 35, 190, 230, 180, { phase: "turn", priority: "normal" }, { shape: "cloud", color: "yellow", fill: "solid" }, ["Play a matching color or value, otherwise draw a card."]),
  element("color-draw", "deck", "Draw Pile", 340, 180, 160, 220, { cardType: "color-card", count: 80, drawRule: "Draw one when no card can be played." }, { shape: "rectangle", color: "violet", fill: "solid" }, ["Cards are hidden until drawn."]),
  element("color-discard", "deck", "Discard Pile", 545, 180, 160, 220, { cardType: "color-card", count: 1, drawRule: "Top card remains visible." }, { shape: "rectangle", color: "orange", fill: "solid" }, ["The top card defines the current matching color and value."]),
  element("color-player-top", "player-area", "Opponent Hand", 300, 35, 450, 105, { player: "opponent", visibility: "private", capacity: 20 }, { shape: "rectangle", color: "light-green", fill: "solid" }, ["Show card count but hide card faces from the local player."]),
  element("color-player-bottom", "player-area", "Your Hand", 300, 455, 450, 105, { player: "local", visibility: "owner", capacity: 20 }, { shape: "rectangle", color: "light-green", fill: "solid" }, ["The owner can see and select every card."]),
  element("color-turn", "token", "Turn Marker", 790, 245, 105, 105, { owner: "active-player", quantity: 1, state: "in-play" }, { shape: "ellipse", color: "red", fill: "solid" }, ["Make the active player unambiguous."]),
];

const routeBuilderElements: StudioElement[] = [
  element("route-board", "board", "Route Map", 260, 110, 700, 450, { dimensions: "700 × 450", zones: ["cities", "routes", "objectives"] }, { shape: "rectangle", color: "green", fill: "semi" }, ["This is the primary shared spatial puzzle."]),
  element("route-score", "track", "Score Track", 260, 20, 700, 65, { minimum: 0, maximum: 100, current: 0 }, { shape: "rectangle", color: "yellow", fill: "solid" }, ["Show every player's score and position."]),
  element("route-cards", "deck", "Route Cards", 20, 125, 190, 150, { cardType: "route", count: 72, drawRule: "Draw two cards during procurement." }, { shape: "rectangle", color: "violet", fill: "solid" }, ["Cards provide the resources used to claim map connections."]),
  element("route-objectives", "deck", "Objective Cards", 20, 315, 190, 150, { cardType: "objective", count: 30, drawRule: "Keep objectives private until scoring." }, { shape: "rectangle", color: "orange", fill: "solid" }, ["Each objective identifies two locations the player should connect."]),
  element("route-market", "tabletop-panel", "Card Market", 1000, 110, 260, 185, { purpose: "Five public route cards", visibility: "public" }, { shape: "rectangle", color: "grey", fill: "solid" }, ["Keep available choices visible without covering the map."]),
  element("route-supply", "token", "Route Pieces", 1030, 340, 120, 120, { owner: "local", quantity: 45, state: "available" }, { shape: "ellipse", color: "blue", fill: "solid" }, ["Quantity should update as routes are claimed."]),
  element("route-player", "player-area", "Player Area", 260, 600, 700, 170, { player: "local", visibility: "owner", capacity: 20 }, { shape: "rectangle", color: "light-green", fill: "solid" }, ["Group the player's hand, objectives, pieces, and scoring summary."]),
  element("route-rule", "rule", "Claim Route", 1000, 520, 260, 170, { phase: "construction", priority: "normal" }, { shape: "cloud", color: "red", fill: "solid" }, ["Spend matching cards, place route pieces, then award points based on route length."]),
];

export const starterTemplates: StarterTemplate[] = [
  {
    id: "build-os-radio-levels",
    name: "Idea to Build Plan (levels)",
    shortName: "Idea to Build Plan",
    description: "A worked example of zooming from a core idea into its risky chunk: a one-glance root loop, with two objects that open into their own levels. Hand off one level at a time.",
    complexity: "multi-level",
    mode: "graph",
    elements: radioElements,
    connections: radioConnections,
  },
  {
    id: "color-match-card-table",
    name: "Color Match Card Table",
    shortName: "Color Match",
    description: "An Uno-style starter with draw and discard piles, two hands, turn state, and a rule object.",
    complexity: "simple",
    mode: "board-game",
    elements: colorMatchElements,
    connections: [
      { id: "color-draw-to-hand", sourceElementId: "color-draw", targetElementId: "color-player-bottom", type: "flow", label: "draw card", properties: { action: "draw", quantity: 1 }, intent: ["A draw transfers a hidden card into the active player's hand."], implementationNotes: [], tags: ["card-flow"] },
      { id: "color-hand-to-discard", sourceElementId: "color-player-bottom", targetElementId: "color-discard", type: "flow", label: "play card", properties: { action: "play", matchBy: ["color", "value"] }, intent: ["A legal play moves a selected card to the visible discard pile."], implementationNotes: [], tags: ["card-flow"] },
      { id: "color-discard-to-draw", sourceElementId: "color-discard", targetElementId: "color-draw", type: "loop", label: "recycle", properties: { preserveTopCard: true }, intent: ["When the draw pile is empty, shuffle the discard pile except its top card into a new draw pile."], implementationNotes: [], tags: ["deck-lifecycle"] },
    ],
  },
  {
    id: "route-builder-table",
    name: "Route Builder Table",
    shortName: "Route Builder",
    description: "A step up in complexity with a shared map, decks, market, pieces, player area, and score track.",
    complexity: "intermediate",
    mode: "board-game",
    elements: routeBuilderElements,
    connections: [
      { id: "route-cards-to-board", sourceElementId: "route-cards", targetElementId: "route-board", type: "relationship", label: "claim routes", properties: {}, intent: ["Route cards are spent to change the shared map."], implementationNotes: [], tags: ["resource-flow"] },
      { id: "route-board-to-score", sourceElementId: "route-board", targetElementId: "route-score", type: "relationship", label: "awards points", properties: {}, intent: ["Claimed routes update the score track."], implementationNotes: [], tags: ["scoring"] },
    ],
  },
];

export function applyStarterTemplate(document: StudioDocument, template: StarterTemplate): StudioDocument {
  const updatedAt = new Date().toISOString();
  return {
    ...document,
    name: template.name,
    mode: template.mode,
    updatedAt,
    elements: structuredClone(template.elements),
    connections: structuredClone(template.connections),
    metadata: { ...document.metadata, starterTemplate: template.id, complexity: template.complexity },
  };
}
