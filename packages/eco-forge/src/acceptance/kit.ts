/**
 * eco-forge acceptance kit. The parts of the ecosystem that can only be verified against YOUR real
 * infrastructure (Bedrock ap-south-1, scanners, GitLab, OpenShift, Vault, IdP, Dependency-Track,
 * DefectDojo) are checked here, in your pre-prod environment, by a read-only probe suite that writes
 * its own structured report. You run one command and send back the report — nothing else.
 *
 * Every check is READ-ONLY: it inspects presence/version/reachability and config, never values of
 * secrets, and never deploys or mutates anything. Secret *values* are never read or printed — only
 * whether a variable is set.
 */

export type CheckStatus = "pass" | "fail" | "skip";
export type Severity = "blocker" | "warn";

export interface CheckResult {
  readonly id: string;
  readonly area: string;
  readonly title: string;
  readonly severity: Severity;
  readonly status: CheckStatus;
  readonly evidence: string;
  readonly remediation: string;
}

/** Injectable environment probe so the suite is testable and side-effect-free in unit tests. */
export interface Probe {
  /** Absolute path of an executable on PATH, or null. */
  readonly which: (cmd: string) => string | null;
  /** First line of `cmd args` stdout, or null if it fails. */
  readonly version: (cmd: string, args: readonly string[]) => string | null;
  /** True if an env var is SET (never returns the value). */
  readonly envSet: (name: string) => boolean;
  /** The value of a NON-secret env var (region, flags) — used only for documented, non-secret names. */
  readonly envValue: (name: string) => string | undefined;
  /** HTTP(S) reachability: resolves to the status code, or null on error/timeout. */
  readonly httpStatus: (url: string) => Promise<number | null>;
  readonly fileExists: (path: string) => boolean;
}

export interface Check {
  readonly id: string;
  readonly area: string;
  readonly title: string;
  readonly severity: Severity;
  readonly run: (p: Probe) => Promise<Omit<CheckResult, "id" | "area" | "title" | "severity">> | Omit<CheckResult, "id" | "area" | "title" | "severity">;
}

const ok = (evidence: string) => ({ status: "pass" as const, evidence, remediation: "" });
const bad = (evidence: string, remediation: string) => ({ status: "fail" as const, evidence, remediation });
const skip = (evidence: string, remediation = "") => ({ status: "skip" as const, evidence, remediation });

const CROSS_REGION = /^(us|eu|apac|global)\./i;
const INDIA_REGIONS = new Set(["ap-south-1", "ap-south-2"]);
// An on-box gateway (headroom and similar) keeps traffic on the host until it forwards to Bedrock.
const LOOPBACK = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\]|0\.0\.0\.0)(:\d+)?(\/|$)/i;

export const CHECKS: readonly Check[] = [
  // ---- Runtime ----
  {
    id: "rt-node", area: "Runtime", title: "Node.js >= 22.22.3", severity: "blocker",
    run: (p) => {
      const v = p.version("node", ["--version"]);
      if (!v) return bad("node not found", "Install Node 22 LTS (>= 22.22.3; Angular 22 needs it).");
      const n = v.replace(/^v/, "").split(".").map(Number);
      const okv = n[0] !== undefined && (n[0] > 22 || (n[0] === 22 && ((n[1] ?? 0) > 22 || ((n[1] ?? 0) === 22 && (n[2] ?? 0) >= 3))));
      return okv ? ok(`node ${v}`) : bad(`node ${v}`, "Upgrade to >= 22.22.3.");
    },
  },
  {
    id: "rt-java", area: "Runtime", title: "Java 21", severity: "blocker",
    run: (p) => {
      const v = p.version("java", ["-version"]);
      if (!v) return bad("java not found", "Install a Java 21 JDK (Temurin/Corretto).");
      return /(\b|_)21[.\s"]/.test(v) || /version "21/.test(v) ? ok(v) : bad(v, "Use Java 21 (the project targets 21).");
    },
  },
  {
    id: "rt-maven", area: "Runtime", title: "Maven available", severity: "blocker",
    run: (p) => (p.which("mvn") ? ok("mvn on PATH") : (p.fileExists("./mvnw") ? ok("mvnw wrapper present") : bad("no mvn / mvnw", "Install Maven or commit the Maven wrapper (mvnw)."))),
  },

  // ---- Provider / data residency (DPDP) ----
  {
    id: "res-bedrock", area: "Residency", title: "Provider is Bedrock in an India region", severity: "blocker",
    run: (p) => {
      const region = p.envValue("AWS_REGION") ?? p.envValue("AWS_DEFAULT_REGION") ?? "";
      const regionOk = INDIA_REGIONS.has(region);
      const regionFix = `Set AWS_REGION=ap-south-1 (or ap-south-2) for India data residency (saw ${region || "(unset)"}).`;
      const useBedrock = (p.envValue("CLAUDE_CODE_USE_BEDROCK") ?? "").toLowerCase();
      const nativeBedrock = useBedrock === "1" || useBedrock === "true";
      const baseUrl = p.envValue("ANTHROPIC_BASE_URL") ?? "";
      // On-box gateway (e.g. headroom): loopback base URL forwarding to Bedrock via AWS_PROFILE.
      const viaLocalGateway = baseUrl !== "" && LOOPBACK.test(baseUrl) && p.envSet("AWS_PROFILE");

      // Topology A — native Bedrock.
      if (nativeBedrock) {
        return regionOk ? ok(`native Bedrock, AWS_REGION=${region}`) : bad(`AWS_REGION=${region || "(unset)"}`, regionFix);
      }
      // Topology B — on-box gateway to Bedrock. Residency holds iff the gateway pins the India
      // region; we can see the creds/region/model here but not the gateway's upstream, so we pass
      // the blocker and flag the one thing left to confirm.
      if (viaLocalGateway) {
        return regionOk
          ? ok(`Bedrock via on-box gateway (${baseUrl}); AWS_PROFILE set, AWS_REGION=${region} — confirm the gateway only forwards to this region`)
          : bad(`on-box gateway but AWS_REGION=${region || "(unset)"}`, regionFix);
      }
      // Topology C — a REMOTE base URL can route out of India; we cannot certify it.
      if (baseUrl !== "" && !LOOPBACK.test(baseUrl)) {
        return bad(`ANTHROPIC_BASE_URL is a remote endpoint (${baseUrl})`, "A remote proxy can route data out of India. Use native Bedrock (CLAUDE_CODE_USE_BEDROCK=1, AWS_REGION=ap-south-1) or an on-box gateway (loopback base URL + AWS_PROFILE) that pins ap-south-1.");
      }
      // Neither topology detected.
      return bad("no Bedrock topology detected (no CLAUDE_CODE_USE_BEDROCK=1 and no on-box gateway)", "Set CLAUDE_CODE_USE_BEDROCK=1 with AWS_REGION=ap-south-1, or run the on-box Bedrock gateway (ANTHROPIC_BASE_URL on loopback + AWS_PROFILE).");
    },
  },
  {
    id: "res-no-cross-region", area: "Residency", title: "No cross-region inference profile", severity: "blocker",
    run: (p) => {
      const models = [p.envValue("ANTHROPIC_MODEL"), p.envValue("ANTHROPIC_SMALL_FAST_MODEL"), p.envValue("ANTHROPIC_DEFAULT_SONNET_MODEL"), p.envValue("ANTHROPIC_DEFAULT_OPUS_MODEL"), p.envValue("ANTHROPIC_DEFAULT_HAIKU_MODEL")].filter(Boolean) as string[];
      if (models.length === 0) return skip("no model IDs set in env", "Set in-region Bedrock model IDs (no us./eu./apac./global. prefix).");
      const offenders = models.filter((m) => CROSS_REGION.test(m));
      return offenders.length === 0 ? ok(`model IDs in-region: ${models.join(", ")}`) : bad(`cross-region prefix: ${offenders.join(", ")}`, "Use in-region model IDs; cross-region inference profiles route out of India and violate residency.");
    },
  },
  {
    id: "res-no-raw-key", area: "Residency", title: "No raw Anthropic API key in prod", severity: "warn",
    run: (p) => {
      const raw = p.envSet("ANTHROPIC_API_KEY");
      const bedrock = (p.envValue("CLAUDE_CODE_USE_BEDROCK") ?? "").toLowerCase();
      if (raw && bedrock !== "1" && bedrock !== "true") return bad("ANTHROPIC_API_KEY set without Bedrock", "Production must use Bedrock ap-south-1, not a raw Anthropic key (US-routed). Remove the key in prod.");
      return ok(raw ? "key present but Bedrock enabled (ok for test)" : "no raw key");
    },
  },

  // ---- Security scanners ----
  ...scannerCheck("sec-semgrep", "Semgrep (SAST)", "semgrep", "Install Semgrep CE (uvx semgrep) or mirror via Nexus."),
  ...scannerCheck("sec-trivy", "Trivy (SCA/images)", "trivy", "Install Trivy and point it at your Nexus/registry mirror."),
  ...scannerCheck("sec-gitleaks", "gitleaks (secret scan)", "gitleaks", "Install gitleaks for the CI secret-scan stage."),

  // ---- eco-forge gates ----
  {
    id: "gate-config", area: "Gates", title: "eco.gates.yaml present", severity: "blocker",
    run: (p) => (p.fileExists("./eco.gates.yaml") ? ok("eco.gates.yaml found") : bad("eco.gates.yaml missing", "Run `eco-forge init` in the project so the gate thresholds are present.")),
  },
  {
    id: "gate-bins", area: "Gates", title: "eco-forge gate CLIs runnable", severity: "blocker",
    run: (p) => {
      const bins = ["eco-forge-gate", "eco-forge-sca", "eco-forge-trace", "eco-forge-spec-lint", "eco-forge-design-lint", "eco-forge-perf", "eco-forge-mutation", "eco-forge-govern"];
      const missing = bins.filter((b) => !p.which(b));
      return missing.length === 0 ? ok(`all gate CLIs on PATH (${bins.length})`) : bad(`missing: ${missing.join(", ")}`, "Install the package globally (npm i -g @yourorg/eco-forge) so the gate CLIs resolve.");
    },
  },

  // ---- Delivery / platform (endpoints come from env; SKIP cleanly when not configured) ----
  endpointCheck("plat-gitlab", "Delivery", "GitLab reachable", "GITLAB_URL", "warn"),
  endpointCheck("plat-vault", "Delivery", "Vault reachable", "VAULT_ADDR", "warn"),
  endpointCheck("plat-idp", "Delivery", "IdP OIDC discovery reachable", "OIDC_DISCOVERY_URL", "warn"),
  endpointCheck("plat-defectdojo", "Delivery", "DefectDojo reachable", "DEFECTDOJO_URL", "warn"),
  endpointCheck("plat-deptrack", "Delivery", "Dependency-Track reachable", "DEPENDENCYTRACK_URL", "warn"),
  {
    id: "plat-oc-devonly", area: "Delivery", title: "OpenShift client present and NOT pointed at prod", severity: "blocker",
    run: (p) => {
      if (!p.which("oc")) return skip("oc not on PATH", "Install the OpenShift CLI where deploys run; harmless to skip in a build-only pre-prod.");
      const ctx = (p.version("oc", ["config", "current-context"]) ?? "").toLowerCase();
      if (!ctx) return skip("no current oc context", "Log in to the Dev cluster only; never a prod context from automation.");
      return /prod/.test(ctx) ? bad(`oc context looks like prod: ${ctx}`, "Automation must target Dev only. Switch context; never oc/kubectl against prod.") : ok(`oc context: ${ctx}`);
    },
  },
];

function scannerCheck(id: string, title: string, cmd: string, remediation: string): Check[] {
  return [{
    id, area: "Security", title, severity: "warn",
    run: (p) => (p.which(cmd) ? ok(`${cmd} on PATH`) : skip(`${cmd} not found`, remediation)),
  }];
}

function endpointCheck(id: string, area: string, title: string, envName: string, severity: Severity): Check {
  return {
    id, area, title, severity,
    run: async (p) => {
      const url = p.envValue(envName);
      if (!url) return skip(`${envName} not set`, `Set ${envName} to your ${title.replace(" reachable", "")} endpoint to verify it here.`);
      const status = await p.httpStatus(url);
      return status !== null && status < 500
        ? ok(`${envName} -> HTTP ${status}`)
        : bad(`${envName} unreachable (${status ?? "no response"})`, `Confirm ${envName} is correct and reachable from pre-prod (proxy/Nexus allowlist).`);
    },
  };
}

export interface KitReport {
  readonly generatedAt: string;
  readonly results: readonly CheckResult[];
  readonly summary: { pass: number; fail: number; skip: number; blockersFailed: number };
  readonly verdict: "READY" | "NOT-READY" | "READY-WITH-WARNINGS";
}

export async function runKit(probe: Probe, checks: readonly Check[] = CHECKS): Promise<KitReport> {
  const results: CheckResult[] = [];
  for (const c of checks) {
    const r = await c.run(probe);
    results.push({ id: c.id, area: c.area, title: c.title, severity: c.severity, ...r });
  }
  const pass = results.filter((r) => r.status === "pass").length;
  const fail = results.filter((r) => r.status === "fail").length;
  const skipped = results.filter((r) => r.status === "skip").length;
  const blockersFailed = results.filter((r) => r.status === "fail" && r.severity === "blocker").length;
  const warnFailed = results.filter((r) => r.status === "fail" && r.severity === "warn").length;
  const verdict = blockersFailed > 0 ? "NOT-READY" : warnFailed > 0 ? "READY-WITH-WARNINGS" : "READY";
  return { generatedAt: new Date().toISOString(), results, summary: { pass, fail, skip: skipped, blockersFailed }, verdict };
}

export function formatMarkdown(report: KitReport): string {
  const icon = (s: CheckStatus) => (s === "pass" ? "✅" : s === "fail" ? "❌" : "⏭️");
  const lines = [
    "# eco-forge acceptance report",
    "",
    `- Generated: ${report.generatedAt}`,
    `- Verdict: **${report.verdict}**`,
    `- Totals: ${report.summary.pass} pass · ${report.summary.fail} fail · ${report.summary.skip} skip · ${report.summary.blockersFailed} blocker(s) failed`,
    "",
    "| Area | Check | Severity | Status | Evidence | Remediation |",
    "|------|-------|----------|--------|----------|-------------|",
  ];
  for (const r of report.results) {
    lines.push(`| ${r.area} | ${r.title} | ${r.severity} | ${icon(r.status)} ${r.status} | ${sanitize(r.evidence)} | ${sanitize(r.remediation)} |`);
  }
  lines.push("", report.verdict === "READY" ? "All blockers pass. Send this report back." : report.verdict === "READY-WITH-WARNINGS" ? "No blockers failed; review the warnings. Send this report back." : "Blockers failed — not production-ready yet. Fix the blocker rows and re-run. Send this report back.");
  return lines.join("\n");
}

function sanitize(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\n/g, " ").slice(0, 300);
}
