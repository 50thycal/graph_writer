import type { StudioConnection, StudioDocument, StudioElement } from "../schema/studio-document";

export interface StarterTemplate {
  id: string;
  name: string;
  shortName: string;
  description: string;
  complexity: "simple" | "intermediate";
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
): StudioElement => ({ id, type, name, transform: { x, y, width, height }, properties, appearance, intent, implementationNotes: [], tags: [type, "starter"] });

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
    id: "color-match-card-table",
    name: "Color Match Card Table",
    shortName: "Color Match",
    description: "An Uno-style starter with draw and discard piles, two hands, turn state, and a rule object.",
    complexity: "simple",
    mode: "board-game",
    elements: colorMatchElements,
    connections: [],
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
