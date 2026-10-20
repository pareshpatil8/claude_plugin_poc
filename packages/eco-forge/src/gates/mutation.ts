/**
 * Mutation-testing gate. A passing test suite proves the code does what the tests say; a mutation
 * score proves the TESTS actually catch regressions (PIT mutates the bytecode / Stryker mutates the
 * TS and checks the suite notices). This is the real "defect-free" signal the plain gates can't give.
 *
 * eco-forge does NOT run the mutators — PIT (Java/Maven) and Stryker (Angular) do that. This is the
 * thin gate: parse their machine report, compute the mutation score, and pass/fail against a
 * threshold. Deterministic and offline (no network, no XML dependency — regex/JSON only).
 */

export interface MutationResult {
  readonly tool: "pit" | "stryker";
  readonly total: number;
  readonly killed: number;
  readonly survived: number;
  readonly noCoverage: number;
  /** killed / (total excluding ignored) as a percentage, rounded to 2 dp. */
  readonly score: number;
}

/** PIT `mutations.xml`: <mutation detected='true' status='KILLED'>…</mutation> per mutant. */
export function parsePit(xml: string): MutationResult {
  const statuses = [...xml.matchAll(/<mutation\b[^>]*\bstatus=["']([A-Z_]+)["']/g)].map((m) => m[1]);
  // Fallback for attribute order differences: also scan standalone <status> elements.
  const all = statuses.length > 0 ? statuses : [...xml.matchAll(/<status>([A-Z_]+)<\/status>/g)].map((m) => m[1]);
  let killed = 0;
  let survived = 0;
  let noCoverage = 0;
  for (const s of all) {
    if (s === "KILLED" || s === "TIMED_OUT" || s === "MEMORY_ERROR") {
      killed++;
    } else if (s === "SURVIVED") {
      survived++;
    } else if (s === "NO_COVERAGE") {
      noCoverage++;
    }
  }
  const total = killed + survived + noCoverage;
  return { tool: "pit", total, killed, survived, noCoverage, score: pct(killed, total) };
}

interface StrykerReport {
  files?: Record<string, { mutants?: { status?: string }[] }>;
}

/** Stryker `mutation-report.json`: files[].mutants[].status in Killed|Survived|NoCoverage|Timeout|Ignored… */
export function parseStryker(json: string): MutationResult {
  const report = JSON.parse(json) as StrykerReport;
  let killed = 0;
  let survived = 0;
  let noCoverage = 0;
  for (const file of Object.values(report.files ?? {})) {
    for (const m of file.mutants ?? []) {
      const s = m.status;
      if (s === "Killed" || s === "Timeout") {
        killed++;
      } else if (s === "Survived") {
        survived++;
      } else if (s === "NoCoverage") {
        noCoverage++;
      }
      // "Ignored" / "CompileError" / "RuntimeError" are excluded from the score denominator.
    }
  }
  const total = killed + survived + noCoverage;
  return { tool: "stryker", total, killed, survived, noCoverage, score: pct(killed, total) };
}

function pct(killed: number, total: number): number {
  return total === 0 ? 0 : Math.round((killed / total) * 10000) / 100;
}

export interface MutationGate {
  readonly result: MutationResult;
  readonly threshold: number;
  readonly pass: boolean;
}

export function gate(result: MutationResult, threshold: number): MutationGate {
  return { result, threshold, pass: result.total > 0 && result.score >= threshold };
}

export function formatMutation(g: MutationGate): string {
  const r = g.result;
  return [
    `mutation (${r.tool}): score ${r.score}% (killed ${r.killed}/${r.total}; survived ${r.survived}, no-coverage ${r.noCoverage})`,
    `threshold ${g.threshold}% → ${g.pass ? "MUTATION PASS" : r.total === 0 ? "MUTATION FAIL (no mutants — did the mutator run?)" : "MUTATION FAIL (tests miss too many mutants)"}`,
  ].join("\n");
}
