import type { Finding, Severity } from "./sarif.js";

export interface Waiver {
  readonly fingerprint: string;
  readonly approver: string;
  /** ISO date; an expired waiver no longer suppresses the finding. */
  readonly expires: string;
  readonly reason: string;
}

export interface GateConfig {
  readonly blockSeverities: readonly Severity[];
  readonly requireApprover: boolean;
  readonly requireExpiry: boolean;
  readonly maxDurationDays: number;
}

export interface PolicyResult {
  readonly pass: boolean;
  readonly blocking: Finding[];
  readonly waived: Finding[];
  readonly invalidWaivers: { waiver: Waiver; problem: string }[];
}

/**
 * A finding blocks when its severity is in blockSeverities AND it has no valid waiver.
 * A waiver is valid only with a named approver and a non-expired, in-policy expiry date — so a
 * waiver can never be a silent, open-ended bypass.
 */
export function applyPolicy(
  findings: readonly Finding[],
  waivers: readonly Waiver[],
  config: GateConfig,
  now: Date = new Date(),
): PolicyResult {
  const invalidWaivers: PolicyResult["invalidWaivers"] = [];
  const validByFingerprint = new Map<string, Waiver>();

  for (const waiver of waivers) {
    const problem = waiverProblem(waiver, config, now);
    if (problem) {
      invalidWaivers.push({ waiver, problem });
    } else {
      validByFingerprint.set(waiver.fingerprint, waiver);
    }
  }

  const blockSet = new Set<Severity>(config.blockSeverities);
  const blocking: Finding[] = [];
  const waived: Finding[] = [];
  for (const f of findings) {
    if (!blockSet.has(f.severity)) {
      continue;
    }
    if (validByFingerprint.has(f.fingerprint)) {
      waived.push(f);
    } else {
      blocking.push(f);
    }
  }
  return { pass: blocking.length === 0, blocking, waived, invalidWaivers };
}

function waiverProblem(waiver: Waiver, config: GateConfig, now: Date): string | null {
  if (config.requireApprover && !waiver.approver?.trim()) {
    return "no approver named";
  }
  if (!waiver.reason?.trim()) {
    return "no reason given";
  }
  if (config.requireExpiry && !waiver.expires) {
    return "no expiry date";
  }
  if (waiver.expires) {
    const expiry = new Date(waiver.expires);
    if (Number.isNaN(expiry.getTime())) {
      return `invalid expiry date "${waiver.expires}"`;
    }
    if (expiry.getTime() < now.getTime()) {
      return `expired on ${waiver.expires}`;
    }
    const maxMs = config.maxDurationDays * 24 * 60 * 60 * 1000;
    if (expiry.getTime() - now.getTime() > maxMs) {
      return `expiry exceeds the ${config.maxDurationDays}-day maximum`;
    }
  }
  return null;
}
