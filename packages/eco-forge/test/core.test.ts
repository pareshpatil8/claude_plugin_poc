import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { detectProject } from "../src/core/detect.js";
import { sha256 } from "../src/core/hash.js";
import { resolveInside, UnsafePathError } from "../src/core/paths.js";
import { render, TemplateError } from "../src/core/render.js";
import { tempDir } from "./helpers.js";

describe("render", () => {
  it("replaces placeholders, tolerating inner whitespace", () => {
    assert.equal(render("Hi {{name}} / {{ name }}", { name: "eco" }), "Hi eco / eco");
  });

  it("fails on undefined variables instead of emitting empty strings", () => {
    assert.throws(() => render("{{a}} {{b}} {{a}}", {}, "x.tmpl"), (error: unknown) => {
      assert.ok(error instanceof TemplateError);
      assert.match((error as Error).message, /x\.tmpl.*a, b/);
      return true;
    });
  });

  it("leaves text without placeholders untouched", () => {
    assert.equal(render("${HOME} {single}", {}), "${HOME} {single}");
  });
});

describe("resolveInside", () => {
  const root = path.resolve("/project");

  it("resolves nested relative paths", () => {
    assert.equal(resolveInside(root, "docs/a.md"), path.join(root, "docs", "a.md"));
  });

  for (const bad of ["", "../outside", "docs/../../outside", "/etc/passwd", "C:\\Windows\\x"]) {
    it(`rejects "${bad}"`, () => {
      assert.throws(() => resolveInside(root, bad), UnsafePathError);
    });
  }
});

describe("sha256", () => {
  it("treats CRLF and LF content as identical (Windows checkouts)", () => {
    assert.equal(sha256("a\r\nb\r\n"), sha256("a\nb\n"));
  });
});

describe("detectProject", () => {
  it("reports an empty directory as greenfield", () => {
    const d = detectProject(tempDir());
    assert.equal(d.greenfield, true);
    assert.equal(d.springBoot, false);
    assert.equal(d.angular, false);
  });

  it("counts any non-metadata file as existing project content", () => {
    const dir = tempDir();
    writeFileSync(path.join(dir, "CLAUDE.md"), "x");
    assert.equal(detectProject(dir).greenfield, false);
  });

  it("finds Spring Boot in a module pom and Angular in frontend/", () => {
    const dir = tempDir();
    mkdirSync(path.join(dir, "backend"));
    writeFileSync(path.join(dir, "backend", "pom.xml"), "<parent><artifactId>spring-boot-starter-parent</artifactId></parent>");
    mkdirSync(path.join(dir, "frontend"));
    writeFileSync(path.join(dir, "frontend", "package.json"), JSON.stringify({ dependencies: { "@angular/core": "x" } }));
    const d = detectProject(dir);
    assert.equal(d.springBoot, true);
    assert.equal(d.angular, true);
    assert.equal(d.greenfield, false);
    assert.equal(d.evidence.length, 2);
  });

  it("does not treat a non-Spring pom or malformed package.json as a match", () => {
    const dir = tempDir();
    writeFileSync(path.join(dir, "pom.xml"), "<project/>");
    writeFileSync(path.join(dir, "package.json"), "{not json");
    const d = detectProject(dir);
    assert.equal(d.springBoot, false);
    assert.equal(d.angular, false);
  });

  it("detects angular.json at the root", () => {
    const dir = tempDir();
    writeFileSync(path.join(dir, "angular.json"), "{}");
    assert.equal(detectProject(dir).angular, true);
  });
});
