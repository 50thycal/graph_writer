import { createStudioDocument, parseStudioDocument, type StudioDocument } from "../../studio/schema/studio-document";

export interface ProjectVersion {
  id: string;
  number: number;
  createdAt: string;
  note?: string;
  document: StudioDocument;
}

export interface StudioProject {
  id: string;
  name: string;
  mode: StudioDocument["mode"];
  createdAt: string;
  updatedAt: string;
  document: StudioDocument;
  versions: ProjectVersion[];
}

export interface ProjectRepository {
  listProjects(): Promise<StudioProject[]>;
  loadProject(id: string): Promise<StudioProject | undefined>;
  saveProject(project: StudioProject): Promise<void>;
  deleteProject(id: string): Promise<void>;
}

const DATABASE_NAME = "graph-writer-studio";
const DATABASE_VERSION = 1;
const PROJECT_STORE = "projects";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(PROJECT_STORE)) {
        request.result.createObjectStore(PROJECT_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open project storage."));
  });
}

function transact<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDatabase().then((database) => new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(PROJECT_STORE, mode);
    const request = operation(transaction.objectStore(PROJECT_STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Project storage operation failed."));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => reject(transaction.error ?? new Error("Project storage transaction failed."));
  }));
}

function validateProject(value: StudioProject): StudioProject {
  return {
    ...value,
    document: parseStudioDocument(value.document),
    versions: (value.versions ?? []).map((version) => ({ ...version, document: parseStudioDocument(version.document) })),
  };
}

export class IndexedDbProjectRepository implements ProjectRepository {
  async listProjects() {
    const projects = await transact<StudioProject[]>("readonly", (store) => store.getAll());
    return projects.map(validateProject).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async loadProject(id: string) {
    const project = await transact<StudioProject | undefined>("readonly", (store) => store.get(id));
    return project ? validateProject(project) : undefined;
  }

  async saveProject(project: StudioProject) {
    await transact<IDBValidKey>("readwrite", (store) => store.put(validateProject(project)));
  }

  async deleteProject(id: string) {
    await transact<undefined>("readwrite", (store) => store.delete(id));
  }
}

export function createProject(name: string, mode: StudioDocument["mode"]): StudioProject {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  return {
    id,
    name,
    mode,
    createdAt: now,
    updatedAt: now,
    versions: [],
    document: createStudioDocument({ id: `document-${id}`, name, mode, createdAt: now, updatedAt: now }),
  };
}

export function snapshotProject(project: StudioProject, note?: string): StudioProject {
  const now = new Date().toISOString();
  const version: ProjectVersion = {
    id: crypto.randomUUID(),
    number: project.versions.reduce((maximum, item) => Math.max(maximum, item.number), 0) + 1,
    createdAt: now,
    note: note?.trim() || undefined,
    document: structuredClone(project.document),
  };
  return { ...project, updatedAt: now, versions: [...project.versions, version] };
}

export function duplicateProject(project: StudioProject): StudioProject {
  const duplicate = createProject(`${project.name} copy`, project.mode);
  duplicate.document = {
    ...structuredClone(project.document),
    id: `document-${duplicate.id}`,
    name: duplicate.name,
    createdAt: duplicate.createdAt,
    updatedAt: duplicate.updatedAt,
  };
  return duplicate;
}
