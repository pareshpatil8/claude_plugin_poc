import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

/** Angular 22 (frontend toolchain) needs Node >= 22.22.3; the eco-forge CLI itself runs on >= 22.12. */
export const NODE_MINIMUM = "22.22.3";

export type CheckStatus = "ok" | "missing" | "outdated";

export interface CheckResult {
  readonly name: string;
  readonly status: CheckStatus;
  readonly required: boolean;
  readonly found?: string;
  readonly minimum?: string;
  readonly hint?: string;
}

/** Returns the first version-looking string in a command's output, or undefined if the command is unavailable. */
export type Probe = (command: string, args: readonly string[]) => string | undefined;

interface ToolSpec {
  readonly name: string;
  readonly candidates: readonly (readonly [string, readonly string[]])[];
  readonly minimum?: string;
  readonly required: boolean;
  readonly hint: string;
}

const TOOLS: readonly ToolSpec[] = [
  { name: "git", candidates: [["git", ["--version"]]], minimum: "2.40.0", required: true, hint: "Install Git (Windows: Git for Windows, which includes Git Bash)" },
  { name: "java", candidates: [["java", ["-version"]]], minimum: "21.0.0", required: true, hint: "Install JDK 21 (Temurin or Red Hat build of OpenJDK)" },
  { name: "container runtime", candidates: [["docker", ["--version"]], ["podman", ["--version"]]], required: true, hint: "Install Podman Desktop or Docker (Windows: WSL2 backend); needed for Testcontainers and eco-devbox" },
  { name: "python", candidates: [["python3", ["--version"]], ["python", ["--version"]], ["py", ["-3", "--version"]]], minimum: "3.11.0", required: true, hint: "Install Python 3.11+ (used by code-review-graph, memsearch and document ingestion)" },
  { name: "uv", candidates: [["uv", ["--version"]]], required: true, hint: "Install uv and point it at the Nexus PyPI proxy" },
  { name: "claude", candidates: [["claude", ["--version"]]], required: true, hint: "Run `eco-forge init`; Claude Code is installed at the version pinned in eco.lock (M1-20)" },
];

export const defaultProbe: Probe = (command, args) => {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    timeout: 15_000,
    // Windows resolves .cmd/.bat shims (mvn, npm) only through the shell; arguments here are fixed literals.
    shell: process.platform === "win32",
    env: { ...process.env, JAVA_TOOL_OPTIONS: "" },
  });
  if (result.error || result.status !== 0) {
    return undefined;
  }
  return extractVersion(`${result.stdout}\n${result.stderr}`) ?? "unknown";
};

export function extractVersion(output: string): string | undefined {
  const match = /(\d+)\.(\d+)(?:\.(\d+))?/.exec(output);
  if (!match) {
    return undefined;
  }
  return `${match[1]}.${match[2]}.${match[3] ?? "0"}`;
}

export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
}

export function runDoctor(dir: string, probe: Probe = defaultProbe, nodeVersion = process.versions.node): CheckResult[] {
  const results: CheckResult[] = [versionCheck("node", nodeVersion, NODE_MINIMUM, true, "Install Node.js 22 LTS (22.23 or later)")];

  for (const tool of TOOLS) {
    let found: string | undefined;
    for (const [command, args] of tool.candidates) {
      found = probe(command, args);
      if (found !== undefined) {
        break;
      }
    }
    results.push(versionCheck(tool.name, found, tool.minimum, tool.required, tool.hint));
  }

  const wrapper = ["mvnw", "mvnw.cmd"].some((f) => existsSync(path.join(dir, f)));
  const maven = wrapper ? "wrapper" : probe("mvn", ["-v"]);
  results.push(
    maven === "wrapper"
      ? { name: "maven", status: "ok", required: true, found: "project wrapper (mvnw)" }
      : versionCheck("maven", maven, "3.9.0", true, "Add the Maven wrapper to the project or install Maven 3.9+"),
  );
  return results;
}

function versionCheck(
  name: string,
  found: string | undefined,
  minimum: string | undefined,
  required: boolean,
  hint: string,
): CheckResult {
  if (found === undefined) {
    return { name, status: "missing", required, hint, ...(minimum ? { minimum } : {}) };
  }
  if (minimum && found !== "unknown" && compareVersions(found, minimum) < 0) {
    return { name, status: "outdated", required, found, minimum, hint };
  }
  return { name, status: "ok", required, found, ...(minimum ? { minimum } : {}) };
}

export function doctorExitCode(results: readonly CheckResult[]): 0 | 1 {
  return results.some((r) => r.required && r.status !== "ok") ? 1 : 0;
}

export function formatDoctor(results: readonly CheckResult[]): string {
  const width = Math.max(...results.map((r) => r.name.length));
  const lines = ["eco-forge doctor", ""];
  for (const r of results) {
    const mark = r.status === "ok" ? "ok      " : r.status === "missing" ? "MISSING " : "OUTDATED";
    const detail = r.found ? r.found : "not found";
    const min = r.minimum ? ` (needs >= ${r.minimum})` : "";
    lines.push(`  ${mark}  ${r.name.padEnd(width)}  ${detail}${r.status === "ok" ? "" : min}`);
    if (r.status !== "ok" && r.hint) {
      lines.push(`            ${" ".repeat(width)}  -> ${r.hint}`);
    }
  }
  lines.push(
    "",
    "Not checked yet: Bedrock in-region model access, proxy/Nexus reachability, MCP health (M1-03).",
  );
  return lines.join("\n");
}
