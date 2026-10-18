import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { effectiveCommands, tokenize } from "../src/guard/command.js";
import { decide } from "../src/guard/hook.js";
import { isValidAadhaar, scanForPii } from "../src/guard/pii.js";
import { evaluateCommand, evaluateRead } from "../src/guard/rules.js";

const blocked = (cmd: string) => assert.equal(evaluateCommand(cmd).allow, false, `should block: ${cmd}`);
const allowed = (cmd: string) => assert.equal(evaluateCommand(cmd).allow, true, `should allow: ${cmd}`);

describe("command normaliser", () => {
  it("unwraps sh -c, nested", () => {
    assert.deepEqual(effectiveCommands(`sh -c "cat /etc/hosts"`), ["cat /etc/hosts"]);
    assert.deepEqual(effectiveCommands(`bash -lc 'sh -c "id"'`), ["id"]);
  });
  it("splits pipelines, &&, ; and newlines", () => {
    assert.deepEqual(effectiveCommands("ls && cat a | grep b ; echo c").sort(), ["cat a", "echo c", "grep b", "ls"].sort());
  });
  it("extracts command substitutions", () => {
    assert.ok(effectiveCommands("echo $(cat secret)").includes("cat secret"));
    assert.ok(effectiveCommands("echo `id`").includes("id"));
  });
  it("tokenise keeps quoted strings whole", () => {
    assert.deepEqual(tokenize(`git commit -m "a b c"`), ["git", "commit", "-m", "a b c"]);
  });
});

describe("secret-read rules (and bypass attempts — M1-08)", () => {
  const direct = [
    "cat ~/.aws/credentials",
    "cat /home/u/.ssh/id_rsa",
    "head -5 .env",
    "cat .env.production",
    "openssl rsa -in server.key",
    "cp ~/.kube/config /tmp/x",
    "base64 ~/.vault-token",
  ];
  for (const cmd of direct) {
    it(`blocks: ${cmd}`, () => blocked(cmd));
  }

  const bypasses = [
    `sh -c "cat ~/.aws/credentials"`,
    `bash -lc 'cat .env'`,
    `\\cat ~/.ssh/id_rsa`, // escaped-alias trick
    `sudo cat /root/.ssh/id_ed25519`,
    `env X=1 cat .env`,
    `timeout 5 cat ~/.vault-token`,
    `echo $(cat ~/.aws/credentials)`,
    `cat $(echo ~/.ssh/id_rsa)`, // inner echo names the secret
    `xargs cat < list ; cat .env`,
    `tar cf out.tar ~/.ssh/id_rsa`,
    `cat ../../home/user/.ssh/id_rsa`,
  ];
  for (const cmd of bypasses) {
    it(`blocks bypass: ${cmd}`, () => blocked(cmd));
  }

  it("allows ordinary reads", () => {
    allowed("cat README.md");
    allowed("head -20 src/main/java/App.java");
    allowed("grep -r TODO src");
    allowed("cat .env.example"); // example files are fine
  });

  it("Read tool path is judged directly", () => {
    assert.equal(evaluateRead("/home/u/.ssh/id_rsa").allow, false);
    assert.equal(evaluateRead("src/app.ts").allow, true);
    assert.equal(evaluateRead(".env.sample").allow, true);
  });
});

describe("force-push and cluster rules", () => {
  it("blocks force pushes however written", () => {
    blocked("git push --force origin main");
    blocked("git push -f");
    blocked("git push --force-with-lease origin main");
    blocked("git push origin +main:main");
    blocked(`sh -c "git push -f"`);
  });
  it("allows normal git", () => {
    allowed("git push origin feature");
    allowed("git commit -m wip");
    allowed("git push -u origin branch");
  });
  it("allows oc/kubectl against Dev only", () => {
    allowed("kubectl --context dev get pods");
    allowed("oc --namespace development apply -f x.yaml");
    allowed("kubectl get pods"); // read-only, no target
    blocked("kubectl --context prod delete pod x");
    blocked("oc -n uat apply -f x.yaml");
    blocked("helm --namespace prod upgrade app .");
    blocked("kubectl delete ns foo"); // mutation without explicit Dev target
  });
});

describe("Aadhaar Verhoeff", () => {
  it("accepts a valid Aadhaar and rejects near-misses", () => {
    assert.equal(isValidAadhaar("234123412346"), true); // valid checksum
    assert.equal(isValidAadhaar("234123412347"), false);
    assert.equal(isValidAadhaar("123456789012"), false); // leading 1 not allowed
  });
});

describe("PII scan", () => {
  it("flags valid Aadhaar (spaced and joined) but not arbitrary 12-digit numbers", () => {
    assert.equal(scanForPii("id 2341 2341 2346").some((f) => f.kind === "aadhaar"), true);
    assert.equal(scanForPii("order 100000000001 shipped").some((f) => f.kind === "aadhaar"), false);
  });
  it("flags a valid PAN", () => {
    assert.equal(scanForPii("PAN ABCPD1234E").some((f) => f.kind === "pan"), true);
    assert.equal(scanForPii("code ABCDE1234F here").some((f) => f.kind === "pan"), false); // 4th char invalid type
  });
  it("flags real-looking phones and emails, ignores example domains and placeholders", () => {
    assert.equal(scanForPii("call +91 98765 43210").some((f) => f.kind === "phone"), true);
    assert.equal(scanForPii("call 0000000000").some((f) => f.kind === "phone"), false);
    assert.equal(scanForPii("a@example.com b@test").some((f) => f.kind === "email"), false);
    assert.equal(scanForPii("real.user@gmail.com").some((f) => f.kind === "email"), true);
  });
  it("flags a bulk export of distinct emails", () => {
    const dump = Array.from({ length: 12 }, (_, i) => `person${i}@company.co.in`).join("\n");
    assert.equal(scanForPii(dump).some((f) => f.kind === "bulk"), true);
  });
  it("redacts samples so the guard output never echoes the raw value", () => {
    const [finding] = scanForPii("real.user@gmail.com");
    assert.ok(finding && !finding.sample.includes("real.user"));
  });
});

describe("hook decision", () => {
  it("blocks a Bash secret read with exit 2 and a deny decision", () => {
    const out = decide({ hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "cat ~/.ssh/id_rsa" } });
    assert.equal(out.exitCode, 2);
    assert.equal(out.decision, "block");
    assert.equal(out.hookSpecificOutput?.permissionDecision, "deny");
  });
  it("blocks a Read of a secret path", () => {
    assert.equal(decide({ tool_name: "Read", tool_input: { file_path: "/root/.aws/credentials" } }).exitCode, 2);
  });
  it("blocks a prompt containing a valid Aadhaar", () => {
    const out = decide({ hook_event_name: "UserPromptSubmit", prompt: "applicant Aadhaar 2341 2341 2346" });
    assert.equal(out.exitCode, 2);
    assert.match(out.reason ?? "", /PII guard/);
  });
  it("blocks PII hidden in a tool input such as a commit message", () => {
    const out = decide({ hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "git commit", description: "contact real.user@gmail.com" } });
    assert.equal(out.exitCode, 2);
  });
  it("allows a clean prompt and a clean command", () => {
    assert.equal(decide({ hook_event_name: "UserPromptSubmit", prompt: "refactor the service layer" }).exitCode, 0);
    assert.equal(decide({ tool_name: "Bash", tool_input: { command: "npm test" } }).exitCode, 0);
  });
});
