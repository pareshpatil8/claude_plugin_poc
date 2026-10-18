// Fails the build if the package declares install-time lifecycle scripts (supply-chain policy).
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const forbidden = ["preinstall", "install", "postinstall"].filter((name) => pkg.scripts?.[name]);
if (forbidden.length > 0) {
  console.error(`Forbidden lifecycle script(s) in package.json: ${forbidden.join(", ")}`);
  process.exit(1);
}
console.log("No install-time lifecycle scripts.");
