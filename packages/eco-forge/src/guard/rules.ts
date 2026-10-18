import { effectiveCommands, tokenize } from "./command.js";

export interface Decision {
  readonly allow: boolean;
  readonly rule?: string;
  readonly reason?: string;
}

const ALLOW: Decision = { allow: true };

/** Paths that must never be read, by basename or by a path fragment anywhere in an argument. */
const SECRET_FRAGMENTS = [
  ".aws/credentials",
  ".aws/config",
  ".kube/config",
  ".kube/",
  ".ssh/",
  ".vault-token",
  "vault-token",
];
// .env and .env.<env>, but NOT the safe-by-convention .env.example/.sample/.template/.dist.
const SECRET_BASENAMES = [/^\.env$/, /^\.env\.(?!example|sample|template|dist\b)[^.]+$/, /\.pem$/, /\.key$/, /\.p12$/, /\.jks$/, /_rsa$/, /id_ed25519$/];
const READ_COMMANDS = new Set(["cat", "less", "more", "head", "tail", "bat", "nl", "od", "xxd", "hexdump", "strings", "cp", "install", "base64", "openssl", "grep", "rg", "awk", "sed", "vi", "vim", "nano", "source", "."]);

/** `oc`/`kubectl` are allowed only against the Dev context/namespace; everything else is blocked. */
const KUBE_COMMANDS = new Set(["oc", "kubectl", "helm", "argocd"]);
const DEV_CONTEXT = /^(dev|development)(-|$)/i;

export function evaluateCommand(raw: string): Decision {
  for (const command of effectiveCommands(raw)) {
    const decision = judgeSingle(command);
    if (!decision.allow) {
      return decision;
    }
  }
  return ALLOW;
}

function judgeSingle(command: string): Decision {
  const tokens = tokenize(command);
  if (tokens.length === 0) {
    return ALLOW;
  }
  const base = (tokens[0] as string).replace(/^\\/, "").split("/").pop() as string;
  const args = tokens.slice(1);

  if ((base === "git" && isForcePush(args)) || base === "git-push-force") {
    return block("no-force-push", "force-pushing rewrites shared history");
  }

  if (KUBE_COMMANDS.has(base)) {
    const target = kubeTarget(args);
    if (target !== null && !DEV_CONTEXT.test(target)) {
      return block("cluster-dev-only", `${base} may only target the Dev context/namespace (saw "${target}")`);
    }
    if (target === null && mutatesCluster(base, args)) {
      return block("cluster-dev-only", `${base} mutation without an explicit --context/-n Dev target is blocked`);
    }
  }

  if (READ_COMMANDS.has(base) || base === "dd") {
    for (const arg of args) {
      const hit = secretPath(arg);
      if (hit) {
        return block("no-secret-read", `reading secret material is blocked (${hit})`);
      }
    }
  }
  // Even non-read commands must not name a secret path (e.g. `tar cf out ~/.ssh/id_rsa`).
  for (const arg of args) {
    const hit = secretPath(arg);
    if (hit && !arg.startsWith("-")) {
      return block("no-secret-read", `touching secret material is blocked (${hit})`);
    }
  }
  return ALLOW;
}

function isForcePush(args: string[]): boolean {
  if (args[0] !== "push") {
    return false;
  }
  return args.some((a) => a === "--force" || a === "-f" || a.startsWith("--force-with-lease") || a === "+HEAD") ||
    args.some((a) => /^\+/.test(a) && a.includes(":"));
}

/** Returns the --context or -n/--namespace value, or null if none was given. */
function kubeTarget(args: string[]): string | null {
  for (let i = 0; i < args.length; i++) {
    const a = args[i] as string;
    if (a === "--context" || a === "-n" || a === "--namespace") {
      return args[i + 1] ?? "";
    }
    const eq = /^--(context|namespace)=(.*)$/.exec(a);
    if (eq) {
      return eq[2] as string;
    }
  }
  return null;
}

function mutatesCluster(base: string, args: string[]): boolean {
  const verbs = new Set(["apply", "delete", "create", "replace", "patch", "scale", "rollout", "drain", "cordon", "edit", "set", "annotate", "label", "exec", "upgrade", "install", "uninstall", "sync"]);
  return args.some((a) => verbs.has(a));
}

function secretPath(arg: string): string | null {
  const normalized = arg.replace(/\\/g, "/");
  for (const fragment of SECRET_FRAGMENTS) {
    if (normalized.includes(fragment)) {
      return fragment;
    }
  }
  const basename = normalized.split("/").pop() ?? normalized;
  for (const pattern of SECRET_BASENAMES) {
    if (pattern.test(basename)) {
      return basename;
    }
  }
  return null;
}

/** For the Read tool: decide directly on the file path, not a shell command. */
export function evaluateRead(filePath: string): Decision {
  const hit = secretPath(filePath);
  return hit ? block("no-secret-read", `reading secret material is blocked (${hit})`) : ALLOW;
}

function block(rule: string, reason: string): Decision {
  return { allow: false, rule, reason };
}
