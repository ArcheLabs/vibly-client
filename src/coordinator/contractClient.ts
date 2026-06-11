/**
 * Adapter that builds a `@vibly-ai/coordinator-http-contract` client carrying
 * CLI-only transport policy:
 *
 * - Bearer token injected via static headers (per-call headers can override
 *   for `Idempotency-Key`).
 * - GET requests are retried with exponential backoff on network failure or
 *   HTTP 5xx; non-GET requests never retry.
 * - 4xx responses are surfaced as-is so the caller (CoordinatorClient method)
 *   can map them to `CoordinatorApiError` via the `runContract` helper.
 *
 * Path strings, JSON envelope handling, and request/response types come from
 * the contract package; only the fetch layer lives here.
 */
import { createCoordinatorClient } from "@vibly-ai/coordinator-http-contract/client";
import { clientVersionHeaders } from "../version.js";
import { logUpgradeRequiredResponse } from "./upgradeRequired.js";
import type { CoordinatorClient as ContractClient } from "@vibly-ai/coordinator-http-contract/client";

export type ContractCoordinatorClient = ContractClient;

export interface CliContractOptions {
  baseUrl: string;
  token: string;
  networkId?: string;
  /** Maximum retries for GET requests (default: 2). */
  maxRetries?: number;
  /** Base delay in ms for exponential backoff (default: 500). */
  retryBaseMs?: number;
}

export function createCliContractClient(opts: CliContractOptions): ContractCoordinatorClient {
  const baseUrl = opts.baseUrl.replace(/\/$/, "");
  const maxRetries = opts.maxRetries ?? 2;
  const retryBaseMs = opts.retryBaseMs ?? 500;

  const cliFetch: typeof fetch = async (input, init) => {
    const method = resolveMethod(input, init);
    const isGet = method === "GET";
    let lastError: unknown;

    for (let attempt = 0; attempt <= (isGet ? maxRetries : 0); attempt++) {
      if (attempt > 0) await sleep(retryBaseMs * 2 ** (attempt - 1));
      try {
        const res = await fetch(input as RequestInfo, init);
        await logUpgradeRequiredResponse(res);
        if (!isGet) return res;
        if (res.status >= 500) {
          lastError = new Error(`HTTP ${res.status}`);
          continue;
        }
        return res;
      } catch (e) {
        lastError = e;
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  };

  return createCoordinatorClient({
    baseUrl,
    fetch: cliFetch,
    headers: {
      Authorization: `Bearer ${opts.token}`,
      ...clientVersionHeaders(),
      ...(opts.networkId ? { "X-Vibly-Network-Id": opts.networkId } : {}),
    },
  });
}

function resolveMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return init.method.toUpperCase();
  if (typeof input === "object" && input !== null && "method" in (input as Request)) {
    return (input as Request).method.toUpperCase();
  }
  return "GET";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
