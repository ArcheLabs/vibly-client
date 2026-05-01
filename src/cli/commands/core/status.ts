import { Command } from "commander";
import { loadConfig } from "../../../config/config.js";
import {
  getActiveProfile,
  getActiveProfileName,
  requireApiToken,
} from "../../../config/profiles.js";
import { outputOk, outputErr, printOutput } from "../../../domain/apiTypes.js";
import { ClientError } from "../../../domain/errors.js";
import { CoordinatorClient } from "../../../coordinator/client.js";

export function registerStatusCommands(program: Command): void {
  program
    .command("status")
    .description("Show current client and connection status")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      const json = !!opts.json;
      try {
        const config = loadConfig();
        const profileName = getActiveProfileName(config);
        const profile = getActiveProfile(config);
        const token = requireApiToken(profile);

        const client = new CoordinatorClient({
          baseUrl: profile.coordinatorUrl,
          token,
        });

        let coordinatorStatus: string;
        let coordinatorVersion: string | undefined;
        try {
          const health = await client.health();
          coordinatorStatus = "connected";
          coordinatorVersion = health.version;
        } catch {
          coordinatorStatus = "unreachable";
        }

        const status = {
          profile: profileName,
          coordinatorUrl: profile.coordinatorUrl,
          coordinatorStatus,
          coordinatorVersion,
          principalId: profile.principalId ?? "(not configured)",
          agentId: profile.agentId ?? "(not configured)",
          projectId: profile.projectId ?? "(not selected)",
        };

        printOutput(outputOk(status), json, (d) => {
          const s = d as typeof status;
          return [
            `Profile:          ${s.profile}`,
            `Coordinator:      ${s.coordinatorUrl}  [${s.coordinatorStatus}]${s.coordinatorVersion ? ` v${s.coordinatorVersion}` : ""}`,
            `Principal:        ${s.principalId}`,
            `Agent:            ${s.agentId}`,
            `Project:          ${s.projectId}`,
          ].join("\n");
        });
      } catch (e) {
        if (e instanceof ClientError) {
          printOutput(outputErr(e.code, e.message, e.hint), json);
        } else {
          printOutput(outputErr("UNKNOWN_ERROR", String(e)), json);
        }
        process.exitCode = 1;
      }
    });

  program
    .command("health")
    .description("Check coordinator health")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      const json = !!opts.json;
      try {
        const config = loadConfig();
        const profile = getActiveProfile(config);
        const token = requireApiToken(profile);
        const client = new CoordinatorClient({ baseUrl: profile.coordinatorUrl, token });
        const health = await client.health();
        printOutput(outputOk(health), json, (d) => {
          const h = d as typeof health;
          return `Coordinator: ${h.status ?? "ok"}  version: ${h.version ?? "unknown"}`;
        });
      } catch (e) {
        if (e instanceof ClientError) {
          printOutput(outputErr(e.code, e.message, e.hint), json);
        } else {
          printOutput(outputErr("COORDINATOR_UNREACHABLE", String(e)), json);
        }
        process.exitCode = 1;
      }
    });
}
