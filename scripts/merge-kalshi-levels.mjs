// Folds the Kalshi master map and its five subsystem maps into one multi-level
// StudioDocument. Each master node that names a `properties.detailMap` becomes the
// parent of every element in that file. Run: node scripts/merge-kalshi-levels.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const dir = resolve("docs/examples");
const read = (file) => JSON.parse(readFileSync(resolve(dir, file), "utf8"));
const master = read("kalshi-bot-master.json");

const elements = master.elements.map((element) => ({ ...element }));
const connections = master.connections.map((connection) => ({ ...connection }));
const usedIds = new Set(elements.map((element) => element.id));
const levels = [];

for (const parent of master.elements) {
  const file = parent.properties?.detailMap;
  if (typeof file !== "string") continue;
  const detail = read(file);
  const prefix = file.replace(/^kalshi-bot-/, "").replace(/\.json$/, "");
  const rename = new Map();
  for (const element of detail.elements) {
    const id = usedIds.has(element.id) ? `${prefix}-${element.id}` : element.id;
    usedIds.add(id);
    rename.set(element.id, id);
    const { detailMap: _ignored, ...properties } = element.properties ?? {};
    elements.push({ ...element, id, properties, parentElementId: parent.id });
  }
  for (const connection of detail.connections) {
    connections.push({
      ...connection,
      id: `${prefix}-${connection.id}`,
      sourceElementId: rename.get(connection.sourceElementId),
      targetElementId: rename.get(connection.targetElementId),
    });
  }
  const { detailMap: _ignored, ...properties } = parent.properties ?? {};
  const merged = elements.find((element) => element.id === parent.id);
  merged.properties = properties;
  merged.intent = (merged.intent ?? []).filter((line) => !/^Detail: /.test(line));
  levels.push({ element: parent.id, source: file, objects: detail.elements.length });
}

const { detailMaps: _ignored, altitude: _altitude, ...metadata } = master.metadata ?? {};
const document = {
  ...master,
  id: "document-kalshi-levels",
  name: "Kalshi Bot — Levels",
  description: "The Kalshi trading system as one multi-level map. The root shows the major systems; zoom into a system to see how it works inside.",
  elements,
  connections,
  metadata: { ...metadata, altitude: "root: subsystems; each service zooms into its own level", levels },
};
writeFileSync(resolve(dir, "kalshi-bot-levels.json"), `${JSON.stringify(document, null, 2)}\n`);
console.log(`Wrote ${elements.length} elements, ${connections.length} connections, ${levels.length} nested levels.`);
