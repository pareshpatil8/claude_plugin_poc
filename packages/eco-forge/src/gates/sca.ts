/**
 * Software Composition Analysis (SCA). Parses dependency-vulnerability reports from Trivy (Java,
 * npm and container images), npm audit and OSV-Scanner into one model carrying the fields a
 * reachability decision needs: the ecosystem, package, installed and fixed versions, severity,
 * whether a fix exists, and whether the dependency is a direct one.
 */
import type { Severity } from "./sarif.js";

export interface ScaFinding {
  readonly ecosystem: "maven" | "npm" | "oci" | "other";
  readonly pkg: string;
  readonly installedVersion: string;
  readonly fixedVersion: string | null;
  readonly vulnId: string;
  readonly severity: Severity;
  readonly direct: boolean;
  readonly title: string;
  readonly source: string;
}

const TRIVY_SEVERITY: Record<string, Severity> = { CRITICAL: "critical", HIGH: "high", MEDIUM: "medium", LOW: "low", UNKNOWN: "info" };
const ECO_BY_TRIVY_TYPE: Record<string, ScaFinding["ecosystem"]> = {
  "jar": "maven", "pom": "maven", "gradle": "maven",
  "npm": "npm", "node-pkg": "npm", "yarn": "npm", "pnpm": "npm",
};

interface TrivyReport {
  Results?: {
    Target?: string;
    Class?: string;
    Type?: string;
    Vulnerabilities?: {
      VulnerabilityID?: string;
      PkgName?: string;
      InstalledVersion?: string;
      FixedVersion?: string;
      Severity?: string;
      Title?: string;
      Relationship?: string; // "direct" | "indirect" in newer Trivy
    }[];
  }[];
}

export function parseTrivy(json: string): ScaFinding[] {
  const report = JSON.parse(json) as TrivyReport;
  const findings: ScaFinding[] = [];
  for (const result of report.Results ?? []) {
    const isImage = result.Class === "os-pkgs";
    const ecosystem = isImage ? "oci" : (ECO_BY_TRIVY_TYPE[result.Type ?? ""] ?? "other");
    for (const v of result.Vulnerabilities ?? []) {
      const fixed = v.FixedVersion?.trim();
      findings.push({
        ecosystem,
        pkg: v.PkgName ?? "unknown",
        installedVersion: v.InstalledVersion ?? "",
        fixedVersion: fixed ? fixed : null,
        vulnId: v.VulnerabilityID ?? "unknown",
        severity: TRIVY_SEVERITY[v.Severity ?? "UNKNOWN"] ?? "info",
        direct: v.Relationship === "direct",
        title: (v.Title ?? "").slice(0, 300),
        source: result.Target ?? "",
      });
    }
  }
  return dedupe(findings);
}

interface NpmAudit {
  vulnerabilities?: Record<string, {
    name?: string;
    severity?: string;
    isDirect?: boolean;
    range?: string;
    fixAvailable?: boolean | { version?: string };
    via?: (string | { source?: number; title?: string; url?: string })[];
  }>;
}

export function parseNpmAudit(json: string): ScaFinding[] {
  const report = JSON.parse(json) as NpmAudit;
  const findings: ScaFinding[] = [];
  for (const [name, v] of Object.entries(report.vulnerabilities ?? {})) {
    const via = (v.via ?? []).find((x) => typeof x === "object") as { title?: string; url?: string } | undefined;
    const fix = typeof v.fixAvailable === "object" ? v.fixAvailable.version ?? "available" : v.fixAvailable ? "available" : null;
    findings.push({
      ecosystem: "npm",
      pkg: v.name ?? name,
      installedVersion: v.range ?? "",
      fixedVersion: fix,
      vulnId: via?.url?.split("/").pop() ?? "npm-advisory",
      severity: (TRIVY_SEVERITY[(v.severity ?? "").toUpperCase()] ?? "info"),
      direct: v.isDirect === true,
      title: via?.title ?? `vulnerability in ${v.name ?? name}`,
      source: "npm-audit",
    });
  }
  return dedupe(findings);
}

function dedupe(findings: ScaFinding[]): ScaFinding[] {
  const seen = new Set<string>();
  return findings.filter((f) => {
    const key = `${f.ecosystem}:${f.pkg}:${f.installedVersion}:${f.vulnId}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
