export type TemplateVars = Readonly<Record<string, string>>;

const PLACEHOLDER = /\{\{\s*([a-zA-Z][a-zA-Z0-9_.]*)\s*\}\}/g;

export class TemplateError extends Error {}

/**
 * Replaces `{{name}}` placeholders. Unknown placeholders are an error rather than an
 * empty string, so a missing variable can never silently produce a broken config file.
 */
export function render(template: string, vars: TemplateVars, source = "<inline>"): string {
  const missing = new Set<string>();
  const output = template.replace(PLACEHOLDER, (_match, name: string) => {
    const value = vars[name];
    if (value === undefined) {
      missing.add(name);
      return "";
    }
    return value;
  });
  if (missing.size > 0) {
    throw new TemplateError(`Template ${source} references undefined variable(s): ${[...missing].join(", ")}`);
  }
  return output;
}
