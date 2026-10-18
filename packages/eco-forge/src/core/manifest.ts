import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const MANIFEST_PATH = ".eco/manifest.json";
const MANIFEST_SCHEMA_VERSION = 1;

export type Codebase = "greenfield" | "brownfield";

export interface ManagedFile {
  /** sha256 of the content eco-forge last wrote; used to detect local edits. */
  readonly sha256: string;
  readonly template: string;
}

export interface Manifest {
  readonly schemaVersion: number;
  readonly ecoForgeVersion: string;
  readonly profile: string;
  /** Classified once, on the first init, so later runs do not mistake eco-forge's own files for project code. */
  readonly codebase?: Codebase;
  readonly files: Readonly<Record<string, ManagedFile>>;
}

export class ManifestError extends Error {}

export function readManifest(root: string): Manifest | undefined {
  const file = path.join(root, MANIFEST_PATH);
  if (!existsSync(file)) {
    return undefined;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new ManifestError(`${MANIFEST_PATH} is not valid JSON: ${(error as Error).message}`);
  }
  if (!isManifest(parsed)) {
    throw new ManifestError(`${MANIFEST_PATH} has an unexpected shape; refusing to continue`);
  }
  if (parsed.schemaVersion > MANIFEST_SCHEMA_VERSION) {
    throw new ManifestError(
      `${MANIFEST_PATH} was written by a newer eco-forge (schema ${parsed.schemaVersion}); upgrade eco-forge first`,
    );
  }
  return parsed;
}

export function serializeManifest(manifest: Manifest): string {
  const sortedFiles = Object.fromEntries(Object.entries(manifest.files).sort(([a], [b]) => a.localeCompare(b)));
  return `${JSON.stringify({ ...manifest, files: sortedFiles }, null, 2)}\n`;
}

function isManifest(value: unknown): value is Manifest {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.schemaVersion !== "number" ||
    typeof candidate.ecoForgeVersion !== "string" ||
    typeof candidate.profile !== "string" ||
    (candidate.codebase !== undefined && candidate.codebase !== "greenfield" && candidate.codebase !== "brownfield") ||
    typeof candidate.files !== "object" ||
    candidate.files === null
  ) {
    return false;
  }
  return Object.values(candidate.files as Record<string, unknown>).every(
    (entry) =>
      typeof entry === "object" &&
      entry !== null &&
      typeof (entry as Record<string, unknown>).sha256 === "string" &&
      typeof (entry as Record<string, unknown>).template === "string",
  );
}
