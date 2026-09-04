interface ValidationIssue {
  path?: Array<string | number>;
  message?: string;
}

export function formatStudioImportError(error: unknown) {
  if (error instanceof SyntaxError) return `Invalid JSON: ${error.message}`;

  if (error && typeof error === "object") {
    const issues = (error as { issues?: unknown }).issues;
    if (Array.isArray(issues) && issues.length > 0) {
      return issues.slice(0, 4).map((issue: ValidationIssue) => {
        const path = issue.path?.length ? issue.path.join(".") : "document";
        return `${path}: ${issue.message ?? "Invalid value"}`;
      }).join("\n");
    }
  }

  return error instanceof Error ? error.message : "Could not import this StudioDocument.";
}
