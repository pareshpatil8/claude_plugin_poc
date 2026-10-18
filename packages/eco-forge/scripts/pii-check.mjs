#!/usr/bin/env node
// DPDP gate: fail if a @Pii-annotated field is referenced in a log statement. Static, dependency-free.
// Usage: node pii-check.mjs <src-root> [...more roots]
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const roots = process.argv.slice(2);
if (roots.length === 0) {
  console.error("usage: pii-check <src-root> [...]");
  process.exit(1);
}

function javaFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...javaFiles(full));
    else if (entry.endsWith(".java")) out.push(full);
  }
  return out;
}

// Collect getter names for @Pii fields, e.g. applicantEmail -> getApplicantEmail.
const piiGetters = new Set();
const piiFields = new Set();
const files = roots.flatMap((r) => javaFiles(r));
for (const file of files) {
  const text = readFileSync(file, "utf8");
  const re = /@Pii\b[^;]*?\b(?:private|protected|public)?\s+\w[\w<>]*\s+(\w+)\s*;/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const field = m[1];
    piiFields.add(field);
    piiGetters.add("get" + field[0].toUpperCase() + field.slice(1));
  }
}

const logRe = /\blog(?:ger)?\s*\.\s*(?:trace|debug|info|warn|error)\s*\(/;
const violations = [];
for (const file of files) {
  const lines = readFileSync(file, "utf8").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!logRe.test(line)) continue;
    for (const getter of piiGetters) {
      if (line.includes(getter + "(")) violations.push({ file, line: i + 1, getter });
    }
    for (const field of piiFields) {
      // crude: a bare field reference inside a log call
      if (new RegExp(`\\b${field}\\b`).test(line) && !line.includes("get")) {
        violations.push({ file, line: i + 1, getter: field });
      }
    }
  }
}

console.log(`pii-check: ${piiFields.size} @Pii field(s) across ${files.length} Java file(s)`);
if (violations.length > 0) {
  for (const v of violations) console.log(`  BLOCK ${v.file}:${v.line} logs PII (${v.getter})`);
  console.log(`PII-CHECK FAIL (${violations.length})`);
  process.exit(2);
}
console.log("PII-CHECK PASS");
