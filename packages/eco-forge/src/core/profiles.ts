import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { GENERATORS, type GeneratorContext } from "./generators.js";
import { resolveInside } from "./paths.js";
import { render } from "./render.js";

interface TemplateEntry {
  readonly dest: string;
  readonly template?: string;
  readonly generator?: string;
}

interface ProfileDefinition {
  readonly name: string;
  readonly description: string;
  readonly files: readonly TemplateEntry[];
}

export interface RenderedFile {
  /** Relative, forward-slash destination inside the project. */
  readonly dest: string;
  /** Template id recorded in the manifest (template path or `generator:<name>`). */
  readonly template: string;
  readonly content: string;
}

export class ProfileError extends Error {}

export const DEFAULT_PROFILE = "springboot-angular";

export function listProfiles(templatesDir: string): string[] {
  if (!existsSync(templatesDir)) {
    return [];
  }
  return readdirSync(templatesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(path.join(templatesDir, entry.name, "profile.json")))
    .map((entry) => entry.name)
    .sort();
}

export function loadProfile(templatesDir: string, name: string): ProfileDefinition {
  const available = listProfiles(templatesDir);
  if (!available.includes(name)) {
    throw new ProfileError(`Unknown profile "${name}". Available: ${available.join(", ") || "(none)"}`);
  }
  const definition = JSON.parse(
    readFileSync(path.join(templatesDir, name, "profile.json"), "utf8"),
  ) as ProfileDefinition;
  const seen = new Set<string>();
  for (const entry of definition.files) {
    if ((entry.template === undefined) === (entry.generator === undefined)) {
      throw new ProfileError(`Profile ${name}: entry "${entry.dest}" needs exactly one of "template" or "generator"`);
    }
    if (seen.has(entry.dest)) {
      throw new ProfileError(`Profile ${name}: duplicate destination "${entry.dest}"`);
    }
    seen.add(entry.dest);
  }
  return definition;
}

export function renderProfile(templatesDir: string, ctx: GeneratorContext): RenderedFile[] {
  const profile = loadProfile(templatesDir, ctx.profile);
  const profileDir = path.join(templatesDir, ctx.profile);
  const vars = {
    projectName: ctx.projectName,
    profile: ctx.profile,
    ecoForgeVersion: ctx.ecoForgeVersion,
    provider: ctx.settings.provider,
    classification: ctx.settings.classification,
  };
  return profile.files.map((entry) => {
    if (entry.generator !== undefined) {
      const generator = GENERATORS[entry.generator];
      if (!generator) {
        throw new ProfileError(`Profile ${ctx.profile}: unknown generator "${entry.generator}"`);
      }
      return { dest: entry.dest, template: `generator:${entry.generator}`, content: generator(ctx) };
    }
    const templatePath = resolveInside(profileDir, entry.template as string);
    const source = readFileSync(templatePath, "utf8");
    return { dest: entry.dest, template: entry.template as string, content: render(source, vars, entry.template) };
  });
}
