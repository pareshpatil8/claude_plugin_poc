/**
 * Normalises a shell command into the list of "effective" command strings a reviewer must judge.
 * Agents (or a compromised prompt) can hide a blocked command behind `sh -c`, `bash -lc`,
 * `env`, `xargs`, pipes, `&&`, command substitution and quoting. The guard decides on the
 * normalised forms, so wrapping does not get a command past a deny rule.
 *
 * This is deliberately conservative: it over-approximates (extracts more candidate commands than
 * strictly run) because a false block is safer than a missed one.
 */

const WRAPPERS = new Set(["sh", "bash", "zsh", "dash", "ksh", "env", "xargs", "nice", "nohup", "setsid", "time", "stdbuf", "timeout", "sudo", "doas", "command", "builtin", "exec", "eval", "watch"]);
const INLINE_FLAGS = new Set(["-c", "-lc", "-ic", "--command"]);

/** Splits on separators, then unwraps each segment, returning every command the string could run. */
export function effectiveCommands(raw: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const queue = [raw];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const segment of splitTopLevel(current)) {
      for (const expanded of expandSubstitutions(segment)) {
        const trimmed = expanded.trim();
        if (trimmed.length === 0 || seen.has(trimmed)) {
          continue;
        }
        seen.add(trimmed);
        const unwrapped = unwrap(trimmed);
        if (unwrapped !== null) {
          queue.push(unwrapped);
        } else {
          out.push(trimmed);
        }
      }
    }
  }
  return out;
}

/** Splits on `;`, `|`, `&&`, `||`, newlines, honouring single/double quotes. */
function splitTopLevel(input: string): string[] {
  const parts: string[] = [];
  let buffer = "";
  let quote: string | null = null;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i] as string;
    if (quote) {
      buffer += ch;
      if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      buffer += ch;
      continue;
    }
    if (/[\n;&|]/.test(ch)) {
      parts.push(buffer);
      buffer = "";
      // Skip the partner of a two-char operator (&&, ||).
      if ((ch === "&" || ch === "|") && input[i + 1] === ch) {
        i++;
      }
      continue;
    }
    buffer += ch;
  }
  parts.push(buffer);
  return parts.filter((p) => p.trim().length > 0);
}

/** Pulls out `$(...)` and backtick command substitutions as their own commands to review. */
function expandSubstitutions(segment: string): string[] {
  const results = [segment];
  const dollar = /\$\(([^()]*)\)/g;
  let match;
  while ((match = dollar.exec(segment)) !== null) {
    results.push(match[1] as string);
  }
  const back = /`([^`]*)`/g;
  while ((match = back.exec(segment)) !== null) {
    results.push(match[1] as string);
  }
  return results;
}

/**
 * If the command is a wrapper (`sh -c "..."`, `sudo cat ...`, `env X=1 cat ...`), returns the
 * inner command to re-review; otherwise null. Strips a leading `\` (escaped alias bypass).
 */
function unwrap(command: string): string | null {
  const tokens = tokenize(command);
  if (tokens.length === 0) {
    return null;
  }
  const head = (tokens[0] as string).replace(/^\\/, "");
  const base = head.split("/").pop() as string;
  if (!WRAPPERS.has(base)) {
    return null;
  }
  const rest = tokens.slice(1);
  // sh -c "INNER": the inline-flag argument is the command.
  for (let i = 0; i < rest.length; i++) {
    if (INLINE_FLAGS.has(rest[i] as string)) {
      return rest[i + 1] ?? null;
    }
  }
  // env/sudo/nice/timeout …: skip their own flags and VAR=VALUE assignments, run the remainder.
  const remaining = rest.filter((t) => !t.startsWith("-") && !/^[A-Za-z_][A-Za-z0-9_]*=/.test(t) && !/^\d+$/.test(t));
  return remaining.length > 0 ? remaining.join(" ") : null;
}

/** Minimal quote-aware tokeniser; keeps quoted strings together and strips surrounding quotes. */
export function tokenize(command: string): string[] {
  const tokens: string[] = [];
  let buffer = "";
  let quote: string | null = null;
  let had = false;
  for (const ch of command) {
    if (quote) {
      if (ch === quote) {
        quote = null;
      } else {
        buffer += ch;
      }
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      had = true;
      continue;
    }
    if (/\s/.test(ch)) {
      if (buffer.length > 0 || had) {
        tokens.push(buffer);
      }
      buffer = "";
      had = false;
      continue;
    }
    buffer += ch;
  }
  if (buffer.length > 0 || had) {
    tokens.push(buffer);
  }
  return tokens;
}
