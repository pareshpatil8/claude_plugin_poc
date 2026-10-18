import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export interface Detection {
  readonly springBoot: boolean;
  readonly angular: boolean;
  readonly gitRepo: boolean;
  /** True when the directory has no project files yet (ignoring VCS and eco-forge metadata). */
  readonly greenfield: boolean;
  readonly evidence: readonly string[];
}

const IGNORED_FOR_GREENFIELD = new Set([".git", ".eco", ".gitignore", ".gitattributes", "README.md", "LICENSE"]);

export function detectProject(root: string): Detection {
  const evidence: string[] = [];

  const springBoot = findPoms(root).some((pom) => {
    const hit = readFileSync(pom, "utf8").includes("spring-boot");
    if (hit) {
      evidence.push(`Spring Boot reference in ${path.relative(root, pom) || "pom.xml"}`);
    }
    return hit;
  });

  let angular = false;
  for (const candidate of [root, path.join(root, "frontend")]) {
    if (existsSync(path.join(candidate, "angular.json"))) {
      angular = true;
      evidence.push(`angular.json in ${path.relative(root, candidate) || "."}`);
      break;
    }
    const pkg = path.join(candidate, "package.json");
    if (existsSync(pkg) && hasAngularDependency(pkg)) {
      angular = true;
      evidence.push(`@angular/core dependency in ${path.relative(root, pkg)}`);
      break;
    }
  }

  const gitRepo = existsSync(path.join(root, ".git"));
  const greenfield = readdirSync(root).every((entry) => IGNORED_FOR_GREENFIELD.has(entry));

  return { springBoot, angular, gitRepo, greenfield, evidence };
}

/** Root pom plus one level of modules (backend/, service dirs), which covers the usual layouts. */
function findPoms(root: string): string[] {
  const poms: string[] = [];
  const rootPom = path.join(root, "pom.xml");
  if (existsSync(rootPom)) {
    poms.push(rootPom);
  }
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
      const pom = path.join(root, entry.name, "pom.xml");
      if (existsSync(pom)) {
        poms.push(pom);
      }
    }
  }
  return poms;
}

function hasAngularDependency(packageJson: string): boolean {
  try {
    const parsed = JSON.parse(readFileSync(packageJson, "utf8")) as Record<string, Record<string, string> | undefined>;
    return Boolean(parsed.dependencies?.["@angular/core"] ?? parsed.devDependencies?.["@angular/core"]);
  } catch {
    return false;
  }
}
