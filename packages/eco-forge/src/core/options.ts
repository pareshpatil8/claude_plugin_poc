export type Provider = "bedrock" | "subscription";
export type Classification = "client" | "synthetic";

export interface ModelTiers {
  readonly high: string;
  readonly mid: string;
  readonly low: string;
}

export interface ProviderSettings {
  readonly provider: Provider;
  readonly classification: Classification;
  readonly awsRegion: string;
  /** Undefined for Bedrock until in-region model IDs are confirmed (see `doctor`). */
  readonly models: ModelTiers | undefined;
}

export class OptionsError extends Error {}

/** India regions only: data residency is a hard requirement for project (client) data. */
export const ALLOWED_BEDROCK_REGIONS = ["ap-south-1", "ap-south-2"] as const;

/**
 * Cross-region inference profile prefixes route requests outside the configured region,
 * which breaks the India residency rule, so they are rejected outright.
 */
const CROSS_REGION_PREFIXES = ["us.", "eu.", "apac.", "jp.", "au.", "global."];

const SUBSCRIPTION_MODELS: ModelTiers = { high: "opus", mid: "sonnet", low: "haiku" };

export interface RawProviderOptions {
  readonly provider?: string | undefined;
  readonly classification?: string | undefined;
  readonly awsRegion?: string | undefined;
  readonly modelHigh?: string | undefined;
  readonly modelMid?: string | undefined;
  readonly modelLow?: string | undefined;
}

export function resolveProviderSettings(raw: RawProviderOptions): ProviderSettings {
  const provider = raw.provider ?? "bedrock";
  if (provider !== "bedrock" && provider !== "subscription") {
    throw new OptionsError(`--provider must be "bedrock" or "subscription" (got "${provider}")`);
  }
  const classification = raw.classification ?? "client";
  if (classification !== "client" && classification !== "synthetic") {
    throw new OptionsError(`--classification must be "client" or "synthetic" (got "${classification}")`);
  }
  if (provider === "subscription" && classification !== "synthetic") {
    throw new OptionsError(
      "The subscription provider is for testing with synthetic data only. " +
        "Use --provider bedrock for project work, or pass --classification synthetic for a test repository.",
    );
  }

  const awsRegion = raw.awsRegion ?? "ap-south-1";
  if (!(ALLOWED_BEDROCK_REGIONS as readonly string[]).includes(awsRegion)) {
    throw new OptionsError(
      `--aws-region must be an India region (${ALLOWED_BEDROCK_REGIONS.join(", ")}) to meet data residency (got "${awsRegion}")`,
    );
  }

  const given = [raw.modelHigh, raw.modelMid, raw.modelLow].filter((m) => m !== undefined);
  if (provider === "subscription") {
    if (given.length > 0) {
      throw new OptionsError("--model-* flags apply to the bedrock provider only; the subscription uses model aliases");
    }
    return { provider, classification, awsRegion, models: SUBSCRIPTION_MODELS };
  }

  if (given.length > 0 && given.length < 3) {
    throw new OptionsError("Pass all three of --model-high, --model-mid and --model-low, or none of them");
  }
  for (const model of given) {
    const prefix = CROSS_REGION_PREFIXES.find((p) => model.startsWith(p));
    if (prefix) {
      throw new OptionsError(
        `Model "${model}" is a cross-region inference profile ("${prefix}"); use an in-region model ID for ${awsRegion}`,
      );
    }
  }
  const models =
    raw.modelHigh !== undefined && raw.modelMid !== undefined && raw.modelLow !== undefined
      ? { high: raw.modelHigh, mid: raw.modelMid, low: raw.modelLow }
      : undefined;
  return { provider, classification, awsRegion, models };
}
