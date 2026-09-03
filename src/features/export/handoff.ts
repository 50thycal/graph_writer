import type { StudioDocument, StudioElement } from "../../studio/schema/studio-document";

export interface HandoffBundle {
  document: StudioDocument;
  json: string;
  markdown: string;
  copyText: string;
  image: Blob;
  imageWidth: number;
  imageHeight: number;
  baseName: string;
}

export interface HandoffContext {
  versionLabel: string;
}

function cleanFileName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "design-handoff";
}

function displayName(element: StudioElement) {
  return element.name?.trim() || element.type;
}

function tableCell(value: string) {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

function formatNotes(notes?: string[]) {
  return notes?.map((note) => `- ${note}`).join("\n") ?? "";
}

function annotatedElements(document: StudioDocument) {
  return document.elements.filter((element) => element.intent?.length || element.implementationNotes?.length);
}

function spatiallySortedElements(document: StudioDocument) {
  return [...document.elements].sort((left, right) =>
    left.transform.y - right.transform.y || left.transform.x - right.transform.x || left.id.localeCompare(right.id));
}

export function generateHandoffMarkdown(document: StudioDocument, context: HandoffContext) {
  const elementById = new Map(document.elements.map((element) => [element.id, element]));
  const baseName = cleanFileName(document.name);
  const lines = [
    "# Design Handoff",
    "",
    `**Project:** ${document.name}`,
    `**Mode:** ${document.mode}`,
    `**Version:** ${context.versionLabel}`,
    `**Updated:** ${document.updatedAt}`,
    "",
  ];

  if (document.description) lines.push("## Objective", "", document.description, "");

  const annotated = annotatedElements(document);
  lines.push("## Design Intent and Implementation Context", "");
  if (!annotated.length && !document.connections.some((connection) => connection.intent?.length || connection.implementationNotes?.length)) {
    lines.push("No hidden design intent or implementation notes are attached yet.", "");
  }

  for (const element of annotated) {
    lines.push(`### ${displayName(element)} (${element.type})`, "");
    if (element.intent?.length) lines.push("**Intent**", "", formatNotes(element.intent), "");
    if (element.implementationNotes?.length) lines.push("**Implementation notes**", "", formatNotes(element.implementationNotes), "");
  }

  for (const connection of document.connections.filter((item) => item.intent?.length || item.implementationNotes?.length)) {
    const source = elementById.get(connection.sourceElementId);
    const target = elementById.get(connection.targetElementId);
    lines.push(`### ${source ? displayName(source) : connection.sourceElementId} → ${target ? displayName(target) : connection.targetElementId}`, "");
    if (connection.label) lines.push(`**Relationship:** ${connection.label} (${connection.type})`, "");
    if (connection.intent?.length) lines.push("**Intent**", "", formatNotes(connection.intent), "");
    if (connection.implementationNotes?.length) lines.push("**Implementation notes**", "", formatNotes(connection.implementationNotes), "");
  }

  lines.push(
    "## Spatial Layout",
    "",
    "Coordinates use canvas space. Objects are ordered top-to-bottom, then left-to-right.",
    "",
    "| Object | Type | X | Y | Width | Height |",
    "|---|---|---:|---:|---:|---:|",
    ...spatiallySortedElements(document).map((element) => {
      const { x, y, width, height } = element.transform;
      return `| ${tableCell(displayName(element))} | ${tableCell(element.type)} | ${Math.round(x)} | ${Math.round(y)} | ${Math.round(width)} | ${Math.round(height)} |`;
    }),
    "",
    "## Flow and Relationships",
    "",
  );

  if (!document.connections.length) lines.push("No semantic connections are defined.", "");
  for (const connection of document.connections) {
    const source = elementById.get(connection.sourceElementId);
    const target = elementById.get(connection.targetElementId);
    const label = connection.label ? ` — ${connection.label}` : "";
    lines.push(`- ${source ? displayName(source) : connection.sourceElementId} → ${target ? displayName(target) : connection.targetElementId} (${connection.type})${label}`);
  }

  lines.push(
    "",
    "## Attached Files",
    "",
    `- \`${baseName}-design.png\` — visual layout and spatial reference`,
    `- \`${baseName}-design.json\` — canonical StudioDocument with semantic properties and exact geometry`,
    `- \`${baseName}-handoff.md\` — this implementation brief`,
  );

  return `${lines.join("\n").trim()}\n`;
}

export function createHandoffBundle(
  document: StudioDocument,
  image: { blob: Blob; width: number; height: number },
  context: HandoffContext,
): HandoffBundle {
  const json = JSON.stringify(document, null, 2);
  const markdown = generateHandoffMarkdown(document, context);
  return {
    document,
    json,
    markdown,
    copyText: `${markdown}\n## StudioDocument JSON\n\n\`\`\`json\n${json}\n\`\`\`\n`,
    image: image.blob,
    imageWidth: image.width,
    imageHeight: image.height,
    baseName: cleanFileName(document.name),
  };
}

export function downloadHandoffFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function textFile(content: string, type: string) {
  return new Blob([content], { type });
}
