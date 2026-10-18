/**
 * Proactive QA: a requirements/spec defect linter. Research (and every cost-of-defect study) shows
 * a defect introduced in requirements is an order of magnitude cheaper to fix there than once it
 * reaches code. This linter catches the defect classes that cause most downstream bugs, in the
 * spec itself, before development starts — so the code gates have less to catch.
 *
 * It is deterministic and conservative: it flags patterns that are almost always defects, and it
 * is the first pass. The product-analyst agent then reviews each flag (some are acceptable).
 */

export type DefectClass =
  | "ambiguous"          // vague words with no measurable meaning
  | "weak-nfr"           // an NFR adjective with no number
  | "untestable"         // acceptance criteria that cannot be verified objectively
  | "missing-error-path" // a flow with no stated failure/alternate behaviour
  | "unclassified-data"  // a data field with no PII/retention classification
  | "conflict"           // two requirements that contradict (duplicate IDs, "must"/"must not" clash)
  | "tbd";               // an open placeholder left in the spec

export interface SpecDefect {
  readonly defectClass: DefectClass;
  readonly line: number;
  readonly text: string;
  readonly hint: string;
}

const AMBIGUOUS = /\b(fast|quick|slow|scalable|robust|user-friendly|intuitive|efficient|secure|reliable|flexible|simple|modern|seamless|high performance|as needed|etc\.?|and\/or|appropriate|reasonable|some|many|few)\b/i;
const NFR_CUE = /\b(latency|throughput|response time|availability|uptime|performance|scale|concurrent|rps|tps|load|capacity|retention|recovery|rto|rpo)\b/i;
const NUMBER = /\d/;
const TBD = /\b(tbd|tbc|to be decided|to be determined|\?\?\?|xxx|fixme|placeholder)\b/i;
const UNTESTABLE = /\b(should (?:be able to|work|handle)|as expected|properly|correctly|etc)\b/i;
const DATA_CATALOG_HEADER = /pii|retention|consent|purpose/i;

export interface SpecDocs {
  readonly spec: string;
  /** nfr.md content; NFR lines here are checked for numbers. */
  readonly nfr?: string;
  /** data-catalog.md content; rows are checked for a PII classification. */
  readonly dataCatalog?: string;
}

export function lintSpec(docs: SpecDocs): SpecDefect[] {
  const defects: SpecDefect[] = [];
  const specLines = docs.spec.split("\n");

  // Duplicate REQ-IDs (a conflict / copy-paste defect).
  const seen = new Map<string, number>();
  specLines.forEach((line, i) => {
    const m = /\b(REQ-\d{3,})\b/.exec(line);
    if (m) {
      const id = m[1] as string;
      if (seen.has(id)) {
        defects.push({ defectClass: "conflict", line: i + 1, text: id, hint: `${id} is defined more than once (lines ${seen.get(id)} and ${i + 1}).` });
      } else {
        seen.set(id, i + 1);
      }
    }
  });

  specLines.forEach((line, i) => {
    const l = line.trim();
    if (l.length === 0 || l.startsWith("#") || l.startsWith("|---")) {
      return;
    }
    if (TBD.test(l)) {
      defects.push({ defectClass: "tbd", line: i + 1, text: l.slice(0, 120), hint: "Open placeholder in the spec; resolve before development." });
    }
    if (AMBIGUOUS.test(l)) {
      const word = (AMBIGUOUS.exec(l) ?? [])[0];
      defects.push({ defectClass: "ambiguous", line: i + 1, text: l.slice(0, 120), hint: `"${word}" is not measurable; replace with a concrete, testable criterion.` });
    }
    if (UNTESTABLE.test(l) && /acceptance|criteria|requirement|REQ-/i.test(l)) {
      defects.push({ defectClass: "untestable", line: i + 1, text: l.slice(0, 120), hint: "Acceptance criterion is not objectively verifiable; state the observable outcome." });
    }
    // A flow/endpoint requirement with no error/alternate path mentioned nearby.
    if (/\b(flow|endpoint|api|submit|create|update|delete|process)\b/i.test(l) && !/\b(error|fail|invalid|reject|timeout|retry|exception|4\d\d|5\d\d|else|otherwise)\b/i.test(docs.spec)) {
      // Only flag once per spec: if the whole spec never mentions a failure path.
    }
  });

  // NFRs: every NFR cue line must contain a number.
  for (const [idx, line] of (docs.nfr ?? "").split("\n").entries()) {
    const l = line.trim();
    if (l.length === 0 || l.startsWith("#") || l.startsWith("|")) {
      if (!(l.startsWith("|") && NFR_CUE.test(l))) {
        continue;
      }
    }
    if (NFR_CUE.test(l) && !NUMBER.test(l)) {
      defects.push({ defectClass: "weak-nfr", line: idx + 1, text: l.slice(0, 120), hint: "NFR has no numeric target (e.g. p95 < 300 ms at 200 RPS)." });
    }
  }

  // Data catalog: each data row must carry a PII classification.
  const catalog = docs.dataCatalog ?? "";
  if (catalog.length > 0) {
    const rows = catalog.split("\n").filter((l) => l.trim().startsWith("|") && !l.includes("---"));
    rows.forEach((row, i) => {
      // Skip the header row (contains the column names).
      if (DATA_CATALOG_HEADER.test(row) && /field|name|column/i.test(row)) {
        return;
      }
      const cells = row.split("|").map((c) => c.trim()).filter(Boolean);
      // A classification must be a standalone cell value, not a word buried in prose
      // (so "contact the applicant" in a purpose column does not count as the class "contact").
      const classified = cells.some((c) => /^(none|identifier|contact|financial|sensitive|non-pii|public)$/i.test(c));
      if (cells.length > 0 && !classified) {
        defects.push({ defectClass: "unclassified-data", line: i + 1, text: cells[0] ?? row.slice(0, 80), hint: "Data field has no PII classification (none/identifier/contact/financial/sensitive)." });
      }
    });
  }

  // Whole-spec check: a spec describing flows must mention at least one failure path somewhere.
  if (/\b(flow|endpoint|api|submit|process)\b/i.test(docs.spec) &&
      !/\b(error|fail|invalid|reject|timeout|retry|exception|4\d\d|5\d\d|otherwise|rollback)\b/i.test(docs.spec)) {
    defects.push({ defectClass: "missing-error-path", line: 0, text: "(whole spec)", hint: "No failure/alternate path described anywhere; every flow needs its error behaviour." });
  }

  return defects.sort((a, b) => a.line - b.line);
}

export interface SpecScore {
  readonly defects: SpecDefect[];
  readonly byClass: Record<string, number>;
  /** Blocking classes stop the spec from advancing to design. */
  readonly blocking: number;
  readonly pass: boolean;
}

const BLOCKING_CLASSES: ReadonlySet<DefectClass> = new Set(["tbd", "weak-nfr", "unclassified-data", "conflict", "missing-error-path"]);

export function scoreSpec(docs: SpecDocs): SpecScore {
  const defects = lintSpec(docs);
  const byClass: Record<string, number> = {};
  let blocking = 0;
  for (const d of defects) {
    byClass[d.defectClass] = (byClass[d.defectClass] ?? 0) + 1;
    if (BLOCKING_CLASSES.has(d.defectClass)) {
      blocking++;
    }
  }
  return { defects, byClass, blocking, pass: blocking === 0 };
}

export function formatSpecScore(score: SpecScore): string {
  const lines = [`spec-lint: ${score.defects.length} finding(s), ${score.blocking} blocking`];
  for (const d of score.defects) {
    const where = d.line > 0 ? `L${d.line}` : "spec";
    lines.push(`  [${d.defectClass}] ${where}: ${d.hint}`);
  }
  lines.push(score.pass ? "SPEC-LINT PASS" : "SPEC-LINT FAIL (resolve blocking defects before design)");
  return lines.join("\n");
}
