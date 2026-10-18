import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GENERATORS, type GeneratorContext } from "../src/core/generators.js";
import { OptionsError, resolveProviderSettings } from "../src/core/options.js";

const IN_REGION = { modelHigh: "anthropic.model-high", modelMid: "anthropic.model-mid", modelLow: "anthropic.model-low" };

describe("resolveProviderSettings", () => {
  it("defaults to Bedrock, client data, ap-south-1 and pending models", () => {
    assert.deepEqual(resolveProviderSettings({}), {
      provider: "bedrock",
      classification: "client",
      awsRegion: "ap-south-1",
      models: undefined,
    });
  });

  it("refuses the subscription provider for client data", () => {
    assert.throws(() => resolveProviderSettings({ provider: "subscription" }), /synthetic data only/);
  });

  it("maps the subscription provider to model aliases", () => {
    const s = resolveProviderSettings({ provider: "subscription", classification: "synthetic" });
    assert.deepEqual(s.models, { high: "opus", mid: "sonnet", low: "haiku" });
  });

  it("rejects --model-* with the subscription provider", () => {
    assert.throws(
      () => resolveProviderSettings({ provider: "subscription", classification: "synthetic", modelHigh: "x" }),
      /bedrock provider only/,
    );
  });

  it("rejects regions outside India", () => {
    assert.throws(() => resolveProviderSettings({ awsRegion: "us-east-1" }), /India region/);
    assert.equal(resolveProviderSettings({ awsRegion: "ap-south-2" }).awsRegion, "ap-south-2");
  });

  for (const prefix of ["us.", "eu.", "apac.", "global."]) {
    it(`rejects cross-region inference profile "${prefix}"`, () => {
      assert.throws(
        () => resolveProviderSettings({ ...IN_REGION, modelMid: `${prefix}anthropic.model` }),
        /cross-region inference profile/,
      );
    });
  }

  it("requires all three model tiers together", () => {
    assert.throws(() => resolveProviderSettings({ modelHigh: "anthropic.a" }), /all three/);
  });

  it("accepts in-region model IDs", () => {
    assert.deepEqual(resolveProviderSettings(IN_REGION).models, {
      high: "anthropic.model-high",
      mid: "anthropic.model-mid",
      low: "anthropic.model-low",
    });
  });

  it("rejects unknown provider and classification values", () => {
    assert.throws(() => resolveProviderSettings({ provider: "openai" }), OptionsError);
    assert.throws(() => resolveProviderSettings({ classification: "public" }), OptionsError);
  });
});

describe("claude-settings generator", () => {
  const ctx = (raw: Parameters<typeof resolveProviderSettings>[0]): GeneratorContext => ({
    projectName: "p",
    profile: "springboot-angular",
    ecoForgeVersion: "0.0.0",
    settings: resolveProviderSettings(raw),
    detection: { springBoot: false, angular: false, gitRepo: false, greenfield: true, evidence: [] },
  });
  const settings = (raw: Parameters<typeof resolveProviderSettings>[0]) =>
    JSON.parse((GENERATORS["claude-settings"] as (c: GeneratorContext) => string)(ctx(raw))) as {
      env: Record<string, string>;
      permissions: { deny: string[] };
    };

  it("configures Bedrock in-region and disables non-essential traffic", () => {
    const { env } = settings(IN_REGION);
    assert.equal(env.CLAUDE_CODE_USE_BEDROCK, "1");
    assert.equal(env.AWS_REGION, "ap-south-1");
    assert.equal(env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC, "1");
    assert.equal(env.ANTHROPIC_DEFAULT_SONNET_MODEL, "anthropic.model-mid");
    assert.equal(env.DISABLE_AUTOUPDATER, "1");
  });

  it("omits model pins until they are confirmed", () => {
    assert.equal(settings({}).env.ANTHROPIC_DEFAULT_OPUS_MODEL, undefined);
  });

  it("sets no Bedrock variables for the subscription provider", () => {
    const { env } = settings({ provider: "subscription", classification: "synthetic" });
    assert.equal(env.CLAUDE_CODE_USE_BEDROCK, undefined);
    assert.equal(env.AWS_REGION, undefined);
  });

  it("denies credential reads and force pushes", () => {
    const { deny } = settings({}).permissions;
    for (const rule of ["Read(~/.aws/**)", "Read(~/.kube/**)", "Read(./.env)", "Bash(git push --force:*)"]) {
      assert.ok(deny.includes(rule), `missing ${rule}`);
    }
  });
});
