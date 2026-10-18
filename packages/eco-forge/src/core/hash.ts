import { createHash } from "node:crypto";

/** Normalises line endings so the same content hashes identically on Windows and Linux. */
export function normalizeEol(content: string): string {
  return content.replace(/\r\n/g, "\n");
}

export function sha256(content: string): string {
  return createHash("sha256").update(normalizeEol(content), "utf8").digest("hex");
}
