import type { Finding, Severity } from "./sarif.js";

export interface ElevateRule {
  /** Regex (as string) matched against the finding's ruleId. */
  readonly pattern: string;
  readonly to: Severity;
}

/**
 * Some scanners under-report severity in SARIF. SpotBugs/FindSecBugs emit every finding as SARIF
 * level "warning" (-> medium) even for command injection, so security bug patterns would never
 * reach the critical/high block list. These defaults restore the right severity by rule-id, which
 * keeps the SARIF parser tool-agnostic and puts the tool-specific knowledge in one reviewable place.
 */
export const DEFAULT_ELEVATIONS: readonly ElevateRule[] = [
  // FindSecBugs injection / SSRF / unsafe-deserialization / path-traversal families.
  { pattern: "COMMAND_INJECTION|SCRIPT_ENGINE_INJECTION|SPEL_INJECTION|EL_INJECTION", to: "critical" },
  { pattern: "SQL_INJECTION|^SQL_|HIBERNATE_INJECTION|JPA_", to: "high" },
  { pattern: "XSS_|XXE_|PATH_TRAVERSAL|SSRF|UNVALIDATED_REDIRECT", to: "high" },
  { pattern: "OBJECT_DESERIALIZATION|DESERIALIZATION_GADGET", to: "high" },
  { pattern: "PREDICTABLE_RANDOM|WEAK_|HARD_CODE_PASSWORD|HARDCODED_|CIPHER_INTEGRITY|DES_USAGE|RSA_", to: "high" },
  { pattern: "TRUST_BOUNDARY|LDAP_INJECTION|XPATH_INJECTION|FORMAT_STRING", to: "high" },
];

const RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

/** Returns findings with severity raised (never lowered) when a rule matches an elevation. */
export function elevate(findings: readonly Finding[], rules: readonly ElevateRule[] = DEFAULT_ELEVATIONS): Finding[] {
  const compiled = rules.map((r) => ({ re: new RegExp(r.pattern), to: r.to }));
  return findings.map((f) => {
    let severity = f.severity;
    for (const { re, to } of compiled) {
      if (re.test(f.ruleId) && RANK[to] < RANK[severity]) {
        severity = to;
      }
    }
    return severity === f.severity ? f : { ...f, severity };
  });
}
