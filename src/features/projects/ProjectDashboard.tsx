import type { StudioDocument } from "../../studio/schema/studio-document";
import { starterTemplates, type StarterTemplate } from "../../studio/templates/starter-templates";
import type { StudioProject } from "./project-repository";

interface ProjectDashboardProps {
  projects: StudioProject[];
  loading: boolean;
  onCreate: (name: string, mode: StudioDocument["mode"]) => void;
  onCreateStarter: (template: StarterTemplate) => void;
  onOpen: (project: StudioProject) => void;
  onDuplicate: (project: StudioProject) => void;
  onDelete: (project: StudioProject) => void;
}

const modes: Array<{ value: StudioDocument["mode"]; label: string }> = [
  { value: "blank", label: "Blank canvas" },
  { value: "graph", label: "Graph" },
  { value: "board-game", label: "Board game" },
  { value: "ui", label: "UI / App" },
  { value: "architecture", label: "Architecture" },
];

export function ProjectDashboard({ projects, loading, onCreate, onCreateStarter, onOpen, onDuplicate, onDelete }: ProjectDashboardProps) {
  const create = (mode: StudioDocument["mode"]) => onCreate(`Untitled ${modes.find((item) => item.value === mode)?.label ?? "design"}`, mode);
  return <main className="project-dashboard">
    <header className="dashboard-header">
      <div className="brand-lockup"><span className="brand-mark">GW</span><div><p>Design Studio</p><h1>Your projects</h1></div></div>
    </header>
    <section className="new-project-section" aria-labelledby="new-project-heading">
      <div><p className="eyebrow">Start designing</p><h2 id="new-project-heading">New project</h2></div>
      <div className="template-grid">{modes.map((mode) => <button key={mode.value} className="template-card" onClick={() => create(mode.value)}>
        <span>{mode.value === "graph" ? "→" : mode.value === "board-game" ? "▦" : mode.value === "ui" ? "▤" : mode.value === "architecture" ? "◇" : "+"}</span>
        {mode.label}
      </button>)}</div>
    </section>
    <section className="starter-section" aria-labelledby="starter-heading">
      <div><p className="eyebrow">Prebuilt examples</p><h2 id="starter-heading">Starter canvases</h2></div>
      <div className="starter-grid">{starterTemplates.map((template) => <button key={template.id} className="starter-card" onClick={() => onCreateStarter(template)}>
        <span>{template.complexity}</span>
        <strong>{template.shortName}</strong>
        <small>{template.description}</small>
      </button>)}</div>
    </section>
    <section className="projects-section" aria-labelledby="projects-heading">
      <div className="section-heading"><div><p className="eyebrow">Stored on this device</p><h2 id="projects-heading">Recent projects</h2></div><span>{projects.length} project{projects.length === 1 ? "" : "s"}</span></div>
      {loading ? <p className="empty-projects">Loading projects…</p> : projects.length === 0 ? <p className="empty-projects">No projects yet. Choose a template above to begin.</p> : <div className="project-grid">{projects.map((project) => <article className="project-card" key={project.id}>
        <button className="project-preview" onClick={() => onOpen(project)} aria-label={`Open ${project.name}`}>
          <span>{project.document.elements.length}</span><small>objects</small><i>{project.document.connections.length} connections</i>
        </button>
        <div className="project-card-copy"><p>{project.mode.replace("-", " ")}</p><h3>{project.name}</h3><span>Edited {new Date(project.updatedAt).toLocaleString()}</span></div>
        <div className="project-card-actions">
          <button onClick={() => onOpen(project)}>Open</button>
          <button onClick={() => onDuplicate(project)}>Duplicate</button>
          <button className="danger-text" onClick={() => onDelete(project)}>Delete</button>
        </div>
      </article>)}</div>}
    </section>
  </main>;
}
