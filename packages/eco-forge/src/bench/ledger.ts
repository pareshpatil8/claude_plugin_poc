import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { RunResult } from "./types.js";

/**
 * Append-only JSONL ledger of completed runs, keyed by cell key. It is the resume state: a run
 * already in the ledger is never repeated. Append-only so a crash mid-session cannot corrupt
 * earlier results; duplicate keys (e.g. a forced re-run) resolve last-wins on read.
 */
export interface LedgerEntry extends RunResult {
  readonly key: string;
  readonly at: string; // ISO timestamp
}

export class Ledger {
  private readonly file: string;
  private readonly entries = new Map<string, LedgerEntry>();

  constructor(dir: string) {
    mkdirSync(dir, { recursive: true });
    this.file = path.join(dir, "ledger.jsonl");
    if (existsSync(this.file)) {
      for (const line of readFileSync(this.file, "utf8").split("\n")) {
        if (line.trim().length === 0) {
          continue;
        }
        const entry = JSON.parse(line) as LedgerEntry;
        this.entries.set(entry.key, entry); // last line for a key wins
      }
    }
  }

  has(key: string): boolean {
    return this.entries.has(key);
  }

  append(key: string, result: RunResult): LedgerEntry {
    const entry: LedgerEntry = { ...result, key, at: new Date().toISOString() };
    appendFileSync(this.file, JSON.stringify(entry) + "\n", "utf8");
    this.entries.set(key, entry);
    return entry;
  }

  all(): LedgerEntry[] {
    return [...this.entries.values()];
  }

  spentUsd(): number {
    return this.all().reduce((sum, e) => sum + (e.usage.costUsd ?? 0), 0);
  }
}
