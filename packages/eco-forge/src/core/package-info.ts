import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PACKAGE_NAME = "@yourorg/eco-forge";

export interface PackageInfo {
  readonly root: string;
  readonly version: string;
  readonly templatesDir: string;
}

let cached: PackageInfo | undefined;

/**
 * Locates the installed package root by walking up from this module. Works from `dist/`
 * (published), from `.test-dist/src/` (tests) and from a global or npx install.
 */
export function packageInfo(): PackageInfo {
  if (cached) {
    return cached;
  }
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (;;) {
    const manifest = path.join(dir, "package.json");
    if (existsSync(manifest)) {
      const parsed = JSON.parse(readFileSync(manifest, "utf8")) as { name?: string; version?: string };
      if (parsed.name === PACKAGE_NAME && typeof parsed.version === "string") {
        cached = { root: dir, version: parsed.version, templatesDir: path.join(dir, "templates") };
        return cached;
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(`Could not locate the ${PACKAGE_NAME} package root`);
    }
    dir = parent;
  }
}
