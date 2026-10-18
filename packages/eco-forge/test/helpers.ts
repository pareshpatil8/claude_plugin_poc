import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after } from "node:test";
import { packageInfo } from "../src/core/package-info.js";

const created: string[] = [];
after(() => {
  for (const dir of created) {
    rmSync(dir, { recursive: true, force: true });
  }
});

export function tempDir(prefix = "eco-forge-test-"): string {
  const dir = mkdtempSync(path.join(tmpdir(), prefix));
  created.push(dir);
  return dir;
}

/** A private copy of the shipped templates, so a test can change a template without touching the repo. */
export function copyTemplates(): string {
  const dir = tempDir("eco-forge-templates-");
  cpSync(packageInfo().templatesDir, dir, { recursive: true });
  return dir;
}

/** Snapshot of every file under a directory: relative path -> content. */
export function snapshot(root: string): Record<string, string> {
  const result: Record<string, string> = {};
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else {
        result[path.relative(root, full).split(path.sep).join("/")] = readFileSync(full, "utf8");
      }
    }
  };
  walk(root);
  return result;
}

export const SYNTHETIC = { provider: "subscription", classification: "synthetic" } as const;
