/**
 * Reachability triage for SCA findings. When a vulnerable package has no fixed version available,
 * blindly blocking is noise and blindly waiving is dangerous. This classifies each finding by
 * evidence the security agent can act on, and encodes the decision rule.
 *
 * Reachability here is a conservative, static approximation (not a full call graph): a finding is
 * treated as reachable unless there is positive evidence it is not — an unused transitive package
 * with no import of it anywhere in first-party source. False "reachable" is safe; false
 * "unreachable" is not, so the rule only down-scopes when the evidence is clear.
 */
import type { ScaFinding } from "./sca.js";

export type Decision = "upgrade" | "block-escalate" | "waive-unreachable" | "monitor";

export interface ReachabilityEvidence {
  readonly fixAvailable: boolean;
  readonly direct: boolean;
  /** The vulnerable package name appears in a first-party import/usage. */
  readonly importedInFirstParty: boolean;
}

export interface Triage {
  readonly finding: ScaFinding;
  readonly reachable: boolean;
  readonly decision: Decision;
  readonly rationale: string;
}

export interface TriageConfig {
  /** Severities that must be acted on (not merely monitored) when reachable. */
  readonly actOn: readonly ScaFinding["severity"][];
}

export const DEFAULT_TRIAGE: TriageConfig = { actOn: ["critical", "high"] };

/**
 * Evidence callback: given a package name, does first-party code import/use it? Injected so the
 * scan logic (grep of src, import maps) is testable and swappable per ecosystem.
 */
export type ImportProbe = (finding: ScaFinding) => boolean;

export function triage(
  findings: readonly ScaFinding[],
  probe: ImportProbe,
  config: TriageConfig = DEFAULT_TRIAGE,
): Triage[] {
  return findings.map((finding) => {
    const importedInFirstParty = finding.direct || probe(finding);
    // Reachable unless it is an indirect dependency that first-party code never imports.
    const reachable = finding.direct || importedInFirstParty;
    return { finding, reachable, ...decide(finding, { fixAvailable: finding.fixedVersion !== null, direct: finding.direct, importedInFirstParty }, reachable, config) };
  });
}

function decide(
  finding: ScaFinding,
  evidence: ReachabilityEvidence,
  reachable: boolean,
  config: TriageConfig,
): { decision: Decision; rationale: string } {
  const mustAct = config.actOn.includes(finding.severity);

  // 1. A fix exists: upgrade is always the answer, whatever the reachability.
  if (evidence.fixAvailable) {
    return { decision: "upgrade", rationale: `Fix available: upgrade ${finding.pkg} to ${finding.fixedVersion}.` };
  }
  // 2. No fix, severity below the act-on threshold: monitor (Dependency-Track watches for a fix).
  if (!mustAct) {
    return { decision: "monitor", rationale: `No fix yet; ${finding.severity} is below the act-on threshold. Monitor for a release.` };
  }
  // 3. No fix, high/critical, and reachable: block and escalate for a human mitigation decision.
  if (reachable) {
    return {
      decision: "block-escalate",
      rationale: `No fix for ${finding.vulnId} in ${finding.pkg}@${finding.installedVersion}; the package is reachable from first-party code. Block and escalate (mitigate, pin, or replace).`,
    };
  }
  // 4. No fix, high/critical, but NOT reachable (indirect + never imported): evidence-backed waiver.
  return {
    decision: "waive-unreachable",
    rationale: `No fix for ${finding.vulnId}, but ${finding.pkg} is an indirect dependency not imported by first-party code — not reachable. Record a time-boxed waiver with this evidence and re-check when a fix ships.`,
  };
}

/**
 * Findings that must fail the build now:
 *  - "upgrade": a fix exists and has not been applied (the easiest, highest-value remedy), so an
 *    act-on-severity vuln with an available fix blocks until the bump is made; and
 *  - "block-escalate": no fix, act-on severity, reachable.
 * "waive-unreachable" and "monitor" do not fail the build (they are tracked, not acted on now).
 */
export function blocking(triaged: readonly Triage[], config: TriageConfig = DEFAULT_TRIAGE): Triage[] {
  return triaged.filter(
    (t) =>
      t.decision === "block-escalate" ||
      (t.decision === "upgrade" && config.actOn.includes(t.finding.severity)),
  );
}

export function formatTriage(triaged: readonly Triage[]): string {
  const lines = [`sca-triage: ${triaged.length} finding(s)`];
  const order: Decision[] = ["block-escalate", "upgrade", "waive-unreachable", "monitor"];
  for (const d of order) {
    for (const t of triaged.filter((x) => x.decision === d)) {
      lines.push(`  [${d}] ${t.finding.severity} ${t.finding.pkg}@${t.finding.installedVersion} ${t.finding.vulnId}${t.reachable ? "" : " (unreachable)"} — ${t.rationale}`);
    }
  }
  lines.push(blocking(triaged).length > 0 ? `SCA FAIL (${blocking(triaged).length} blocking)` : "SCA PASS");
  return lines.join("\n");
}
