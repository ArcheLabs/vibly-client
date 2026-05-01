/**
 * Adapter that gives the CLI a typed `@vibly/coordinator-http-contract`
 * client while keeping CLI-specific transport policy (Bearer auth,
 * Idempotency-Key, retries with exponential backoff for GETs, request
 * timeout). The contract client is plugged with a custom `fetch` that
 * forwards through the CLI's existing retry-aware request helper, so all
 * methods in `CoordinatorClient` can incrementally migrate without
 * losing those CLI-only behaviours.
 *
 * This is intentionally a thin wrapper - it does not expose contract
 * methods directly; instead, `CoordinatorClient` calls them and uses the
 * contract types to enforce that the paths exist in the OpenAPI spec.
 */
import { createCoordinatorClient } from "@vibly/coordinator-http-contract/client";
import type {
  CoordinatorClient as ContractClient,
} from "@vibly/coordinator-http-contract/client";

export type ContractCoordinatorClient = ContractClient;

export interface CliFetchOptions {
  baseUrl: string;
  token: string;
  /** Custom fetch with retry/idempotency wired in (provided by the CoordinatorClient). */
  fetch: typeof fetch;
}

export function createCliContractClient(opts: CliFetchOptions): ContractCoordinatorClient {
  return createCoordinatorClient({
    baseUrl: opts.baseUrl,
    fetch: opts.fetch,
    headers: {
      Authorization: `Bearer ${opts.token}`,
    },
  });
}
