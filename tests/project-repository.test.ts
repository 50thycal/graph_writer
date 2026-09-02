import { describe, expect, it } from "vitest";
import { createProject, duplicateProject, snapshotProject } from "../src/features/projects/project-repository";

describe("project model", () => {
  it("creates a project with matching canonical document metadata", () => {
    const project = createProject("Agent graph", "graph");
    expect(project.name).toBe("Agent graph");
    expect(project.mode).toBe("graph");
    expect(project.document.name).toBe("Agent graph");
    expect(project.document.mode).toBe("graph");
    expect(project.document.id).toBe(`document-${project.id}`);
  });

  it("creates immutable sequential snapshots", () => {
    const project = createProject("Board", "board-game");
    project.document.elements.push({ id: "card-1", type: "card", transform: { x: 0, y: 0, width: 100, height: 140 } });
    const first = snapshotProject(project, "Initial card");
    first.document.elements[0].name = "Changed draft";
    expect(first.versions[0].number).toBe(1);
    expect(first.versions[0].note).toBe("Initial card");
    expect(first.versions[0].document.elements[0].name).toBeUndefined();
    expect(project.versions).toHaveLength(0);
  });

  it("duplicates document content without copying version history", () => {
    const original = snapshotProject(createProject("UI idea", "ui"), "checkpoint");
    const copy = duplicateProject(original);
    expect(copy.id).not.toBe(original.id);
    expect(copy.document.id).not.toBe(original.document.id);
    expect(copy.name).toBe("UI idea copy");
    expect(copy.versions).toEqual([]);
  });
});
