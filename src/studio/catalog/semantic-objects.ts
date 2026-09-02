import type { StudioDocument, StudioElement } from "../schema/studio-document";

export interface SemanticObjectPreset {
  type: string;
  label: string;
  icon: string;
  description: string;
  width: number;
  height: number;
  appearance: NonNullable<StudioElement["appearance"]>;
  properties: Record<string, unknown>;
  tags: string[];
}

const preset = (
  type: string,
  label: string,
  icon: string,
  description: string,
  properties: Record<string, unknown> = {},
  width = 240,
  height = 140,
  shape = "rectangle",
  color = "blue",
): SemanticObjectPreset => ({
  type,
  label,
  icon,
  description,
  width,
  height,
  appearance: { shape, color, fill: "solid" },
  properties,
  tags: [type],
});

const generic = [
  preset("concept", "Concept", "◇", "A general structured idea", { status: "draft" }),
  preset("note", "Semantic note", "✎", "Hidden implementation context", { audience: "implementation" }, 220, 120, "cloud", "yellow"),
  preset("container", "Container", "▢", "A named area or grouping", { purpose: "" }, 360, 240, "rectangle", "grey"),
];

const catalogs: Record<StudioDocument["mode"], SemanticObjectPreset[]> = {
  blank: generic,
  graph: [
    preset("input", "Input", "⇥", "Starting data or trigger", { dataType: "", required: true }, 190, 110, "pill", "green"),
    preset("agent", "Agent", "◆", "AI or human reasoning step", { role: "", model: "", inputs: [], outputs: [], tools: [], retryCount: 0 }, 250, 150, "rectangle", "violet"),
    preset("tool", "Tool", "⌁", "External capability used by an agent", { toolName: "", operation: "" }, 210, 120, "hexagon", "orange"),
    preset("transform", "Transform", "↻", "Deterministic data transformation", { inputSchema: "", outputSchema: "" }, 230, 130, "rectangle", "blue"),
    preset("gate", "Gate", "◇", "Conditional routing decision", { condition: "", truePath: "", falsePath: "" }, 180, 180, "diamond", "yellow"),
    preset("human-checkpoint", "Human checkpoint", "◉", "Explicit review or approval", { reviewer: "", approvalCriteria: "" }, 250, 140, "rectangle", "red"),
    preset("output", "Output", "⇤", "Result returned by the graph", { dataType: "", destination: "" }, 190, 110, "pill", "green"),
    ...generic,
  ],
  "board-game": [
    preset("board", "Board", "▦", "Primary play surface", { dimensions: "", zones: [] }, 420, 300, "rectangle", "green"),
    preset("card", "Card", "▤", "Playable or reference card", { title: "", category: "", rules: "", value: 0, visibility: "public" }, 180, 250, "rectangle", "blue"),
    preset("deck", "Deck", "▥", "Collection of cards", { cardType: "", count: 0, drawRule: "" }, 190, 140, "rectangle", "violet"),
    preset("token", "Token", "●", "Movable game piece or marker", { owner: "", quantity: 1, state: "available" }, 120, 120, "ellipse", "orange"),
    preset("player-area", "Player area", "⌂", "Private or player-specific region", { player: "", visibility: "owner", capacity: 0 }, 360, 230, "rectangle", "light-green"),
    preset("track", "Track", "━", "Ordered progress or scoring track", { minimum: 0, maximum: 10, current: 0 }, 360, 100, "rectangle", "yellow"),
    preset("tabletop-panel", "Tabletop panel", "▧", "Public information panel", { purpose: "", visibility: "public" }, 300, 190, "rectangle", "grey"),
    preset("rule", "Rule", "§", "Rule attached to the design", { phase: "", priority: "normal" }, 250, 140, "cloud", "red"),
    ...generic,
  ],
  ui: [
    preset("screen", "Screen", "▣", "Application screen or route", { route: "", device: "responsive" }, 360, 280, "rectangle", "grey"),
    preset("panel", "Panel", "▤", "Layout section or information panel", { purpose: "" }, 300, 200),
    preset("button", "Button", "▰", "Interactive action", { action: "", state: "default" }, 180, 80, "pill", "green"),
    preset("input-field", "Input", "⌨", "User input control", { inputType: "text", required: false }, 240, 80, "rectangle", "blue"),
    preset("navigation", "Navigation", "☰", "Navigation region", { destinations: [] }, 300, 100, "rectangle", "violet"),
    preset("modal", "Modal", "▣", "Temporary focused interface", { trigger: "", dismissal: "" }, 300, 220, "rectangle", "orange"),
    ...generic,
  ],
  architecture: [
    preset("service", "Service", "⬡", "Deployable software service", { responsibility: "", runtime: "", repository: "" }, 260, 150, "hexagon", "blue"),
    preset("database", "Database", "▱", "Persistent data store", { technology: "", data: "", retention: "" }, 220, 150, "rectangle", "violet"),
    preset("api", "API", "⇄", "System interface or contract", { protocol: "HTTP", endpoint: "", authentication: "" }, 230, 120, "pill", "green"),
    preset("queue", "Queue", "≋", "Asynchronous message channel", { topic: "", delivery: "at-least-once" }, 240, 110, "rectangle", "orange"),
    preset("external-system", "External system", "◎", "Dependency outside this design", { owner: "", interface: "" }, 260, 150, "rectangle", "grey"),
    preset("user", "Actor", "◉", "Person or system actor", { role: "", permissions: [] }, 180, 130, "ellipse", "yellow"),
    ...generic,
  ],
};

export function semanticObjectsForMode(mode: StudioDocument["mode"]) {
  return catalogs[mode];
}
