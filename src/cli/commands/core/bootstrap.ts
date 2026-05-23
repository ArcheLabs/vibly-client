import type { Command } from "commander";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import {
  getAgentDir,
  getAgentEnrollmentPath,
  getAgentSessionKeyPath,
  getAgentsDir,
  getWorkspacesDir,
  getMemoryDir,
} from "../../../config/paths.js";
import { loadConfig } from "../../../config/config.js";
import { getActiveProfile } from "../../../config/profiles.js";
import { handleCliError } from "../shared/errors.js";

async function generateSessionKey(): Promise<{ publicKey: string; signerUri: string }> {
  // Dynamic import to avoid loading Polkadot at startup
  const [keyringModule, cryptoModule] = await Promise.all([
    import("@polkadot/keyring"),
    import("@polkadot/util-crypto"),
  ]);
  const { Keyring } = keyringModule as unknown as {
    Keyring: new (opts: { type: "sr25519" }) => { addFromUri: (uri: string) => { address: string } };
  };
  const { cryptoWaitReady, mnemonicGenerate } = cryptoModule as unknown as {
    cryptoWaitReady: () => Promise<void>;
    mnemonicGenerate: () => string;
  };
  await cryptoWaitReady();
  const mnemonic = mnemonicGenerate();
  const kr = new Keyring({ type: "sr25519" });
  const pair = kr.addFromUri(mnemonic);
  return { publicKey: pair.address, signerUri: mnemonic };
}

export function registerBootstrapCommands(program: Command): void {
  program
    .command("bootstrap")
    .description("Initialize a new local agent identity and generate an enrollment descriptor")
    .option("--name <name>", "Agent display name (defaults to hostname)")
    .option("--capabilities <caps>", "Comma-separated capabilities", "research,code")
    .option("--organization-ids <ids>", "Comma-separated organization IDs", "default")
    .option("--scopes <scopes>", "Session key scopes", "availability,task_result,pause_duty,resume_duty")
    .option("--agent-id <id>", "Explicit agent ID (auto-generated if omitted)")
    .option("--force", "Overwrite existing agent directory")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        // ── Ensure base dirs exist ──────────────────────────────────────────
        for (const d of [getAgentsDir(), getWorkspacesDir(), getMemoryDir()]) {
          if (!existsSync(d)) mkdirSync(d, { recursive: true });
        }

        const agentId: string = (opts.agentId as string | undefined) ?? `agent_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
        const agentDir = getAgentDir(agentId);
        const enrollPath = getAgentEnrollmentPath(agentId);
        const secretPath = getAgentSessionKeyPath(agentId);

        if (existsSync(agentDir) && !opts.force) {
          process.stderr.write(`Agent directory already exists: ${agentDir}\nUse --force to overwrite.\n`);
          process.exitCode = 1;
          return;
        }

        mkdirSync(agentDir, { recursive: true });

        // ── Generate session key ────────────────────────────────────────────
        const { publicKey, signerUri } = await generateSessionKey();

        const displayName: string =
          (opts.name as string | undefined) ?? hostname();

        const capabilities = (opts.capabilities as string).split(",").map((s: string) => s.trim()).filter(Boolean);
        const organizationIds = (opts.organizationIds as string).split(",").map((s: string) => s.trim()).filter(Boolean);
        const scopes = (opts.scopes as string).split(",").map((s: string) => s.trim()).filter(Boolean);

        const descriptor = {
          displayName,
          sessionPublicKey: publicKey,
          keyType: "sr25519",
          capabilities,
          organizationIds,
          scopes,
          localAgentId: agentId,
          createdAt: new Date().toISOString(),
        };

        const secret = {
          keyType: "sr25519",
          signerUri,
          sessionPublicKey: publicKey,
          localAgentId: agentId,
          createdAt: new Date().toISOString(),
        };

        // ── Write files ─────────────────────────────────────────────────────
        writeFileSync(enrollPath, `${JSON.stringify(descriptor, null, 2)}\n`, { mode: 0o644 });
        writeFileSync(secretPath, `${JSON.stringify(secret, null, 2)}\n`, { mode: 0o600 });

        // ── Determine Console URL ───────────────────────────────────────────
        let consoleUrl = "https://console.vibly.network";
        try {
          const config = loadConfig();
          const profile = getActiveProfile(config);
          if (profile.coordinatorUrl) {
            const u = new URL(profile.coordinatorUrl);
            // Heuristic: replace api. or coordinator. prefix
            consoleUrl = profile.coordinatorUrl
              .replace(/\/\/api\./, "//console.")
              .replace(/\/\/coordinator\./, "//console.")
              .replace(/:\d+$/, "");
          }
        } catch {
          // Use default
        }

        const enrollUrl = `${consoleUrl}/personal-center`;

        if (opts.json) {
          process.stdout.write(`${JSON.stringify({ agentId, descriptor, enrollPath, secretPath, enrollUrl }, null, 2)}\n`);
          return;
        }

        process.stdout.write(`\n  Agent bootstrapped: ${agentId}\n\n`);
        process.stdout.write(`  Session public key : ${publicKey}\n`);
        process.stdout.write(`  Enrollment file    : ${enrollPath}\n`);
        process.stdout.write(`  Session secret     : ${secretPath}  ← KEEP PRIVATE\n\n`);
        process.stdout.write(`  Next step → Open Console and add a local agent:\n`);
        process.stdout.write(`  ${enrollUrl}\n\n`);
        process.stdout.write(`  Paste the enrollment.json contents when prompted.\n\n`);
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });
}
