import path from "node:path";

export class UnsafePathError extends Error {}

/**
 * Resolves a template destination inside the project root. Rejects absolute paths and
 * anything that would escape the root, so a malformed profile can never write outside it.
 */
export function resolveInside(root: string, relative: string): string {
  if (relative.length === 0 || path.isAbsolute(relative) || /^[a-zA-Z]:/.test(relative)) {
    throw new UnsafePathError(`Destination must be a non-empty relative path: "${relative}"`);
  }
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, relative);
  const rel = path.relative(resolvedRoot, resolved);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new UnsafePathError(`Destination escapes the project root: "${relative}"`);
  }
  return resolved;
}

/** Manifest keys always use forward slashes so manifests are portable across OSes. */
export function toPosix(relative: string): string {
  return relative.split(path.sep).join("/");
}
