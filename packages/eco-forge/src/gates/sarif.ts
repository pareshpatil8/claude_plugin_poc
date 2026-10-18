/**
 * Reduces one or more SARIF reports to the NEW findings only (diffed against a baseline), deduped
 * across tools, sorted by severity. Agents and reviewers read this compact list, never the raw
 * multi-thousand-line scanner output, which keeps token use bounded (design §9.3).
 */

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export interface Finding {
  readonly tool: string;
  readonly ruleId: string;
  readonly severity: Severity;
  readonly message: string;
  readonly file: string;
  readonly line: number;
  /** Stable identity for baselining: tool+rule+file+line, independent of message wording. */
  readonly fingerprint: string;
}

const LEVEL_TO_SEVERITY: Record<string, Severity> = { error: "high", warning: "medium", note: "low", none: "info" };
const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

interface SarifLog {
  runs?: {
    tool?: { driver?: { name?: string; rules?: { id?: string; properties?: { tags?: string[] }; defaultConfiguration?: { level?: string } }[] } };
    results?: {
      ruleId?: string;
      level?: string;
      message?: { text?: string };
      properties?: { security_severity?: string | number };
      locations?: { physicalLocation?: { artifactLocation?: { uri?: string }; region?: { startLine?: number } } }[];
    }[];
  }[];
}

export function parseSarif(json: string): Finding[] {
  const log = JSON.parse(json) as SarifLog;
  const findings: Finding[] = [];
  for (const run of log.runs ?? []) {
    const tool = run.tool?.driver?.name ?? "unknown";
    // Semgrep (and others) leave per-result `level` null and declare it on the rule instead.
    const ruleLevels = new Map<string, string>();
    for (const rule of run.tool?.driver?.rules ?? []) {
      if (rule.id && rule.defaultConfiguration?.level) {
        ruleLevels.set(rule.id, rule.defaultConfiguration.level);
      }
    }
    for (const result of run.results ?? []) {
      const loc = result.locations?.[0]?.physicalLocation;
      const file = normalise(loc?.artifactLocation?.uri ?? "");
      const line = loc?.region?.startLine ?? 0;
      const ruleId = result.ruleId ?? "unknown";
      findings.push({
        tool,
        ruleId: shortRuleId(ruleId),
        severity: severityOf(result, ruleLevels.get(ruleId)),
        message: (result.message?.text ?? "").split("\n")[0]?.slice(0, 300) ?? "",
        file,
        line,
        fingerprint: `${tool}:${shortRuleId(ruleId)}:${file}:${line}`,
      });
    }
  }
  return findings;
}

function severityOf(
  result: NonNullable<NonNullable<SarifLog["runs"]>[number]["results"]>[number],
  ruleLevel: string | undefined,
): Severity {
  // GitHub-style security_severity (CVSS 0-10) wins when present.
  const score = Number(result.properties?.security_severity);
  if (!Number.isNaN(score) && result.properties?.security_severity !== undefined) {
    if (score >= 9) return "critical";
    if (score >= 7) return "high";
    if (score >= 4) return "medium";
    if (score > 0) return "low";
  }
  // Per-result level, else the rule's declared level (Semgrep), else a safe default.
  return LEVEL_TO_SEVERITY[result.level ?? ruleLevel ?? "warning"] ?? "medium";
}

function normalise(uri: string): string {
  return uri.replace(/^file:\/\//, "").replace(/^\.\//, "");
}

/** Scanners prefix rule ids with the config path (tmp.xx.quality.semgrep.eco-x); keep the leaf. */
function shortRuleId(ruleId: string): string {
  const leaf = ruleId.split(".").pop() ?? ruleId;
  return leaf.length > 0 ? leaf : ruleId;
}

export interface ReduceResult {
  readonly newFindings: Finding[];
  readonly suppressedByBaseline: number;
  readonly duplicates: number;
}

/** Keeps only findings whose fingerprint is not in the baseline; dedupes; sorts by severity. */
export function reduce(all: readonly Finding[], baseline: ReadonlySet<string> = new Set()): ReduceResult {
  const seen = new Set<string>();
  let suppressed = 0;
  let duplicates = 0;
  const newFindings: Finding[] = [];
  for (const f of all) {
    if (baseline.has(f.fingerprint)) {
      suppressed++;
      continue;
    }
    if (seen.has(f.fingerprint)) {
      duplicates++;
      continue;
    }
    seen.add(f.fingerprint);
    newFindings.push(f);
  }
  newFindings.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.file.localeCompare(b.file) || a.line - b.line);
  return { newFindings, suppressedByBaseline: suppressed, duplicates };
}

export function fingerprints(findings: readonly Finding[]): string[] {
  return [...new Set(findings.map((f) => f.fingerprint))].sort();
}
