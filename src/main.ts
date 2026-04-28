#!/usr/bin/env node
import { loadEnv } from "./config/env.js";
import { buildCli } from "./cli/index.js";

loadEnv();

const program = buildCli();
program.parseAsync(process.argv).catch((e) => {
  process.stderr.write(`Fatal: ${String(e)}\n`);
  process.exit(1);
});
