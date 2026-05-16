import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CoordinatorClient } from "../../coordinator/client.js";
import type { ClientProfile } from "../../domain/clientTypes.js";
import type { DaemonConfig } from "../../schemas/daemon.js";
import { getDataDir } from "../../config/paths.js";
import { getLogger } from "../../config/logger.js";
import {
  planLlmVibingMathActions,
  stableIdempotencyKey,
  toLlmAgentConfig,
  type LlmChat,
} from "../../e2e/llmVibingMathAgent.js";

type Memory = {
  completedActionKeys: string[];
  artifactIdsByTaskId: Record<string, string>;
};

export async function llmE2eHandler(
  client: CoordinatorClient,
  profile: ClientProfile,
  daemonConfig: DaemonConfig,
): Promise<void> {
  if (!daemonConfig.llmE2E) return;
  const principalId = profile.principalId;
  if (!principalId) return;
  const log = getLogger();
  const llm = createOpenAiCompatibleChat();
  if (!llm) {
    log.warn("daemon: llmE2E enabled but OPENAI_API_KEY is not set");
    return;
  }

  try {
    const inbox = await client.getAgentInbox(principalId, { projectId: profile.projectId, limit: 50 });
    const agent = toLlmAgentConfig(profile, inbox);
    if (!agent) return;
    const memory = await loadMemory();
    const completed = new Set(memory.completedActionKeys);
    const actions = await planLlmVibingMathActions({ agent, inbox, llm });

    for (const planned of actions) {
      if (completed.has(planned.key)) continue;
      const payload = { ...planned.intent.payload };
      if (planned.intent.type === "SubmitTask") {
        const taskId = String(payload["taskId"] ?? "");
        const artifactId = memory.artifactIdsByTaskId[taskId];
        if (artifactId) payload["artifactIds"] = [artifactId];
      }

      log.info({ type: planned.intent.type, principalId }, "daemon: submitting live LLM E2E action");
      const receipt = await client.submitActionIntent({
        ...planned.intent,
        payload,
        idempotencyKey: stableIdempotencyKey(planned.key),
      });
      if (planned.intent.type === "SubmitArtifact" && planned.artifactTaskId) {
        memory.artifactIdsByTaskId[planned.artifactTaskId] = receipt.aggregateRef.id;
      }
      completed.add(planned.key);
      memory.completedActionKeys = [...completed].sort();
      await saveMemory(memory);
    }
  } catch (e) {
    log.warn({ err: String(e) }, "daemon: llmE2E handler error");
  }
}

function createOpenAiCompatibleChat(): LlmChat | undefined {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) return undefined;
  const baseUrl = (process.env["OPENAI_BASE_URL"] ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env["OPENAI_MODEL"] ?? "gpt-4o-mini";
  return {
    async complete(system: string, user: string): Promise<string> {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.3,
          max_tokens: 1400,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      });
      const text = await response.text();
      if (!response.ok) throw new Error(`LLM request failed: HTTP ${response.status} ${text}`);
      const body = JSON.parse(text) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      return body.choices?.[0]?.message?.content?.trim() ?? "";
    },
  };
}

async function loadMemory(): Promise<Memory> {
  const memoryPath = getMemoryPath();
  try {
    const parsed = JSON.parse(await readFile(memoryPath, "utf8")) as Partial<Memory>;
    return {
      completedActionKeys: Array.isArray(parsed.completedActionKeys) ? parsed.completedActionKeys.map(String) : [],
      artifactIdsByTaskId: parsed.artifactIdsByTaskId && typeof parsed.artifactIdsByTaskId === "object"
        ? Object.fromEntries(Object.entries(parsed.artifactIdsByTaskId).map(([k, v]) => [k, String(v)]))
        : {},
    };
  } catch {
    return { completedActionKeys: [], artifactIdsByTaskId: {} };
  }
}

async function saveMemory(memory: Memory): Promise<void> {
  const memoryPath = getMemoryPath();
  await mkdir(path.dirname(memoryPath), { recursive: true });
  await writeFile(memoryPath, JSON.stringify(memory, null, 2) + "\n");
}

function getMemoryPath(): string {
  return path.join(getDataDir(), "llm-e2e-actions.json");
}
