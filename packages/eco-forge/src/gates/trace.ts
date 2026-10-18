/**
 * Traceability gate. Every requirement ID (REQ-nnn) declared in a feature's spec must have at
 * least one automated test referencing it and at least one UAT case referencing it; and no test
 * or UAT case may reference a REQ-ID that the spec does not declare (no orphans). This is what
 * makes the spec the single source of truth (design §6.1).
 */

export const REQ_PATTERN = /\bREQ-\d{3,}\b/g;

export interface TraceInputs {
  /** spec.md contents (declares the authoritative REQ-IDs). */
  readonly spec: string;
  /** Concatenated test sources (any language). */
  readonly tests: string;
  /** uat.md contents. */
  readonly uat: string;
}

export interface TraceReport {
  readonly declared: string[];
  readonly missingTest: string[];
  readonly missingUat: string[];
  readonly orphanInTests: string[];
  readonly orphanInUat: string[];
  readonly pass: boolean;
}

function ids(text: string): Set<string> {
  return new Set(text.match(REQ_PATTERN) ?? []);
}

/** A REQ-ID is "declared" only where the spec defines it: at line start as `REQ-nnn:` or in a table cell. */
export function declaredIds(spec: string): Set<string> {
  const declared = new Set<string>();
  for (const line of spec.split("\n")) {
    const m = /^\s*\|?\s*(REQ-\d{3,})\b/.exec(line) ?? /^\s*(REQ-\d{3,})\s*:/.exec(line);
    if (m) {
      declared.add(m[1] as string);
    }
  }
  // Fall back to any mention if the spec uses a looser style, so we never under-report coverage needs.
  if (declared.size === 0) {
    return ids(spec);
  }
  return declared;
}

export function checkTraceability(inputs: TraceInputs): TraceReport {
  const declared = declaredIds(inputs.spec);
  const inTests = ids(inputs.tests);
  const inUat = ids(inputs.uat);

  const missingTest = [...declared].filter((id) => !inTests.has(id)).sort();
  const missingUat = [...declared].filter((id) => !inUat.has(id)).sort();
  const orphanInTests = [...inTests].filter((id) => !declared.has(id)).sort();
  const orphanInUat = [...inUat].filter((id) => !declared.has(id)).sort();

  return {
    declared: [...declared].sort(),
    missingTest,
    missingUat,
    orphanInTests,
    orphanInUat,
    pass: missingTest.length === 0 && missingUat.length === 0 && orphanInTests.length === 0 && orphanInUat.length === 0,
  };
}

export function formatTrace(report: TraceReport): string {
  const lines = [`trace-check: ${report.declared.length} requirement(s) declared`];
  const section = (label: string, items: string[]) => {
    for (const id of items) {
      lines.push(`  ${label}: ${id}`);
    }
  };
  section("no test", report.missingTest);
  section("no UAT case", report.missingUat);
  section("orphan in tests (not in spec)", report.orphanInTests);
  section("orphan in UAT (not in spec)", report.orphanInUat);
  lines.push(report.pass ? "TRACE PASS" : "TRACE FAIL");
  return lines.join("\n");
}
