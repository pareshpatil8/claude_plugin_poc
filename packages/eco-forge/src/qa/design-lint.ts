/**
 * Proactive QA, Layer 1: a design-defect linter. Finds design defects before construction —
 * requirements with no design coverage, API operations without error responses or auth, and
 * significant decisions with no ADR. Deterministic first pass; the solution-architect agent
 * reviews each finding.
 */
import { declaredIds, REQ_PATTERN } from "../gates/trace.js";

export type DesignDefectClass =
  | "untraced-requirement"   // a REQ-ID in the spec that no design document references
  | "orphan-design"          // a design section citing a REQ-ID the spec never declared
  | "op-missing-error"       // an OpenAPI operation with only success responses
  | "op-missing-auth"        // an OpenAPI operation with no security and not explicitly public
  | "undocumented-decision"; // design text signalling a decision with no ADR link

export interface DesignDefect {
  readonly defectClass: DesignDefectClass;
  readonly subject: string;
  readonly hint: string;
}

export interface DesignDocs {
  readonly spec: string;
  /** hld.md + lld.md + integration.md concatenated. */
  readonly design: string;
  /** openapi.yaml (parsed leniently; no YAML dependency). */
  readonly openapi?: string;
  /** Names/paths of ADR files present, to resolve "see ADR-xxxx" references. */
  readonly adrs?: readonly string[];
}

const DECISION_CUE = /\b(we (?:chose|decided|will use)|decision:|trade-?off|instead of|rather than|selected|adopt(?:ed)?)\b/i;
const ADR_REF = /\bADR[-\s]?\d+\b/i;

export function lintDesign(docs: DesignDocs): DesignDefect[] {
  const defects: DesignDefect[] = [];
  const declared = declaredIds(docs.spec);
  const inDesign = new Set(docs.design.match(REQ_PATTERN) ?? []);

  for (const id of [...declared].sort()) {
    if (!inDesign.has(id)) {
      defects.push({ defectClass: "untraced-requirement", subject: id, hint: `${id} has no design coverage; add the HLD/LLD section that realises it.` });
    }
  }
  for (const id of [...inDesign].sort()) {
    if (!declared.has(id)) {
      defects.push({ defectClass: "orphan-design", subject: id, hint: `Design cites ${id}, which the spec does not declare (scope creep or a stale ID).` });
    }
  }

  if (docs.openapi) {
    defects.push(...lintOpenApi(docs.openapi));
  }

  // Decisions without an ADR reference nearby.
  for (const line of docs.design.split("\n")) {
    if (DECISION_CUE.test(line) && !ADR_REF.test(line)) {
      defects.push({ defectClass: "undocumented-decision", subject: line.trim().slice(0, 100), hint: "A design decision with no ADR reference; record it as an ADR so the trade-off is reviewable." });
    }
  }
  return defects;
}

/**
 * Lenient OpenAPI scan (indentation-based, no YAML lib): walk operations under each path and check
 * that each declares a non-2xx response and some form of security. Over-approximates: it flags an
 * operation only when it clearly has success-only responses or no security anywhere.
 */
function lintOpenApi(openapi: string): DesignDefect[] {
  const defects: DesignDefect[] = [];
  const lines = openapi.split("\n");
  const methods = /^\s{2,}(get|post|put|patch|delete):\s*$/i;
  const globalSecurity = /^security:/m.test(openapi);

  let current: { method: string; path: string; start: number } | null = null;
  let currentPath = "";
  const flush = (endExclusive: number) => {
    if (!current) {
      return;
    }
    const block = lines.slice(current.start, endExclusive).join("\n");
    const responseCodes = [...block.matchAll(/^\s+['"]?(\d{3})['"]?:/gm)].map((m) => m[1] as string);
    const hasError = responseCodes.some((c) => c.startsWith("4") || c.startsWith("5"));
    if (responseCodes.length > 0 && !hasError) {
      defects.push({ defectClass: "op-missing-error", subject: `${current.method.toUpperCase()} ${current.path}`, hint: "Operation declares only success responses; add the error responses (400/401/403/404/409/5xx)." });
    }
    const hasSecurity = /^\s+security:/m.test(block) || globalSecurity;
    const explicitlyPublic = /x-public:\s*true/i.test(block);
    if (!hasSecurity && !explicitlyPublic) {
      defects.push({ defectClass: "op-missing-auth", subject: `${current.method.toUpperCase()} ${current.path}`, hint: "Operation has no security requirement; add auth or mark it x-public: true deliberately." });
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string;
    const pathMatch = /^\s{2,}(\/[^\s:]*):\s*$/.exec(line);
    if (pathMatch && !methods.test(line)) {
      flush(i);
      current = null;
      currentPath = pathMatch[1] as string;
      continue;
    }
    const methodMatch = methods.exec(line);
    if (methodMatch) {
      flush(i);
      current = { method: methodMatch[1] as string, path: currentPath, start: i };
    }
  }
  flush(lines.length);
  return defects;
}

export interface DesignScore {
  readonly defects: DesignDefect[];
  readonly byClass: Record<string, number>;
  readonly pass: boolean;
}

export function scoreDesign(docs: DesignDocs): DesignScore {
  const defects = lintDesign(docs);
  const byClass: Record<string, number> = {};
  for (const d of defects) {
    byClass[d.defectClass] = (byClass[d.defectClass] ?? 0) + 1;
  }
  // All design-defect classes block: each is a gap that would otherwise surface as a code defect.
  return { defects, byClass, pass: defects.length === 0 };
}

export function formatDesignScore(score: DesignScore): string {
  const lines = [`design-lint: ${score.defects.length} finding(s)`];
  for (const d of score.defects) {
    lines.push(`  [${d.defectClass}] ${d.subject} — ${d.hint}`);
  }
  lines.push(score.pass ? "DESIGN-LINT PASS" : "DESIGN-LINT FAIL (resolve before construction)");
  return lines.join("\n");
}
