import type { Command } from "commander";
import { existsSync, statSync } from "node:fs";
import { homedir, platform, release, arch } from "node:os";
import { execSync } from "node:child_process";
import { loadConfig } from "../../../config/config.js";
import { getActiveProfile, getApiToken } from "../../../config/profiles.js";
import {
  getViblyhome,
  getConfigPath,
  getAgentsDir,
  getWorkspacesDir,
  getMemoryDir,
  getDatabasePath,
} from "../../../config/paths.js";
import { CoordinatorClient } from "../../../coordinator/client.js";
import { CLIENT_VERSION, CONTRACT_VERSION, PROTOCOL_VERSION } from "../../../version.js";

interface CheckResult {
  label: string;
  status: "ok" | "warn" | "error" | "info";
  detail?: string;
}

function icon(status: CheckResult["status"]): string {
  return { ok: "✓", warn: "⚠", error: "✗", info: "•" }[status];
}

function runCheck(label: string, fn: () => Omit<CheckResult, "label">): CheckResult {
  try {
    return { label, ...fn() };
  } catch (e) {
    return { label, status: "error", detail: String(e) };
  }
}

function commandVersion(cmd: string, args: string[] = ["--version"]): string | null {
  try {
    return execSync(`${cmd} ${args.join(" ")}`, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim().split("\n")[0] ?? null;
  } catch {
    return null;
  }
}

function checkNodeVersion(): Omit<CheckResult, "label"> {
  const v = process.versions.node;
  const [major] = v.split(".").map(Number);
  if ((major ?? 0) < 20) return { status: "error", detail: `Node.js ${v} — requires >=20` };
  return { status: "ok", detail: `Node.js ${v}` };
}

function checkDir(label: string, path: string): CheckResult {
  if (!existsSync(path)) return { label, status: "warn", detail: `Missing: ${path}` };
  const st = statSync(path);
  if (!st.isDirectory()) return { label, status: "error", detail: `Not a directory: ${path}` };
  return { label, status: "ok", detail: path };
}

export function registerDoctorCommands(program: Command): void {
  program
    .command("doctor")
    .description("Check environment prerequisites and local setup")
    .option("--json", "Output results as JSON")
    .option("--offline", "Skip coordinator/network checks")
    .option("--post-upgrade", "Run post-upgrade verification checks")
    .action(async (opts) => {
      const json = Boolean(opts.json);
      const checks: CheckResult[] = [];

      // ── System ──────────────────────────────────────────────────────────────
      checks.push({ label: "OS", status: "info", detail: `${platform()} ${release()} (${arch()})` });
      checks.push(runCheck("Node.js", checkNodeVersion));

      const gitV = commandVersion("git");
      checks.push({ label: "git", status: gitV ? "ok" : "warn", detail: gitV ?? "not found" });
      const npmV = commandVersion("npm");
      checks.push({ label: "npm", status: npmV ? "ok" : "error", detail: npmV ?? "not found" });
      const pnpmV = commandVersion("pnpm");
      checks.push({ label: "pnpm", status: pnpmV ? "ok" : "info", detail: pnpmV ?? "not installed (optional)" });
      checks.push({ label: "client version", status: "ok", detail: `@vibly/client ${CLIENT_VERSION}, contract ${CONTRACT_VERSION}, protocol ${PROTOCOL_VERSION}` });

      // ── VIBLY_HOME directories ──────────────────────────────────────────────
      const home = getViblyhome();
      checks.push({ label: "VIBLY_HOME", status: existsSync(home) ? "ok" : "warn", detail: home });
      checks.push(checkDir("agents dir", getAgentsDir()));
      checks.push(checkDir("workspaces dir", getWorkspacesDir()));
      checks.push(checkDir("memory dir", getMemoryDir()));

      const dbPath = getDatabasePath();
      checks.push({ label: "local database", status: existsSync(dbPath) ? "ok" : "warn", detail: dbPath });

      const cfgPath = getConfigPath();
      checks.push({ label: "config file", status: existsSync(cfgPath) ? "ok" : "warn", detail: cfgPath });

      // ── Profile & coordinator connectivity ──────────────────────────────────
      if (!opts.offline) {
        let coordinatorCheck: CheckResult;
        try {
          const config = loadConfig();
          const profile = getActiveProfile(config);
          if (!profile.coordinatorUrl) throw new Error("coordinatorUrl not set in active profile");
          const client = new CoordinatorClient({ baseUrl: profile.coordinatorUrl, token: getApiToken(profile) ?? "", networkId: profile.network?.id });
          const [health, policy] = await Promise.all([client.health(), client.getVersionPolicy()]);
          coordinatorCheck = {
            label: "coordinator",
            status: "ok",
            detail: `${profile.coordinatorUrl} — v${health.version ?? "?"}`,
          };
          checks.push({
            label: "version policy",
            status: CLIENT_VERSION < policy.minimumClientVersion ? "error" : "ok",
            detail: `min=${policy.minimumClientVersion} recommended=${policy.recommendedClientVersion} contractMin=${policy.minimumContractVersion}`,
          });
        } catch (e) {
          coordinatorCheck = { label: "coordinator", status: "error", detail: String(e) };
        }
        checks.push(coordinatorCheck);
      } else {
        checks.push({ label: "coordinator", status: "info", detail: "skipped (--offline)" });
      }

      // ── Executor runtimes (optional) ────────────────────────────────────────
      for (const bin of ["codex", "claude"]) {
        const v = commandVersion(bin);
        checks.push({ label: `executor:${bin}`, status: v ? "ok" : "info", detail: v ?? "not installed (optional)" });
      }

      // ── Output ──────────────────────────────────────────────────────────────
      if (json) {
        process.stdout.write(`${JSON.stringify(checks, null, 2)}\n`);
        return;
      }

      process.stdout.write(`\nvibly doctor — ${new Date().toISOString()}\n`);
      process.stdout.write(`  Home: ${homedir()}\n\n`);

      for (const c of checks) {
        const i = icon(c.status);
        const detail = c.detail ? `  ${c.detail}` : "";
        process.stdout.write(`  ${i}  ${c.label.padEnd(22)}${detail}\n`);
      }

      const errors = checks.filter((c) => c.status === "error");
      const warns = checks.filter((c) => c.status === "warn");
      process.stdout.write(`\n  ${checks.length} checks — ${errors.length} errors, ${warns.length} warnings\n\n`);

      if (errors.length > 0) process.exitCode = 1;
    });
}
