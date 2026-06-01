#!/usr/bin/env node
/**
 * Guard: forbid handwritten coordinator paths outside transport adapters.
 *
 * The contract package (@vibly-ai/coordinator-http-contract) is the single
 * source of truth for HTTP paths. Callers should use
 * `this.contract.METHOD("/typed/path", ...)` from coordinator/client.ts.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../src", import.meta.url).pathname;
const ALLOWED = ["/coordinator/sse.ts", "/coordinator/contractClient.ts"];
const PATTERNS = [
  /\bfetch\(\s*['"`]\/(projects|events|health|negotiations|reviews|incentives|governance|traces|agents|principals|objectives|knowledge|state|context|memberships|reputation|risk|guardian|streams|assignments|scenarios|phase-[a-z])\b/,
  /\bnew\s+EventSource\(\s*['"`]\/(projects|streams)\b/,
];

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) yield* walk(full);
    else if (full.endsWith(".ts") || full.endsWith(".tsx")) yield full;
  }
}

const violations = [];
for (const file of walk(ROOT)) {
  if (ALLOWED.some((allowed) => file.includes(allowed))) continue;
  const content = readFileSync(file, "utf8");
  for (const pattern of PATTERNS) {
    const match = content.match(pattern);
    if (match) {
      violations.push({ file: file.replace(`${ROOT}/`, ""), match: match[0] });
      break;
    }
  }
}

if (violations.length > 0) {
  console.error(
    "[contract guard] Handwritten coordinator paths detected outside src/coordinator adapters.",
  );
  for (const v of violations) console.error(` - ${v.file}: ${v.match}`);
  process.exit(1);
}

console.log("[contract guard] OK");
