/**
 * Typed coordinator paths derived from the OpenAPI contract.
 *
 * Until vibly-client fully migrates to the contract client, individual
 * methods in `CoordinatorClient` still use the in-house retry/auth
 * machinery against string paths. To prevent path drift, those string
 * paths can be wrapped in `path("/health")` which restricts the literal
 * to keys of `paths` from `@vibly/coordinator-http-contract`.
 *
 * Example:
 *
 *   await this.request<HealthResponse>(path("/health"));
 *
 * If the OpenAPI contract removes `/health`, the type system fails the
 * build (the literal is no longer assignable to `KnownPath`). New paths
 * need to either appear in the contract first, or live behind a
 * documented escape hatch.
 */
import type { paths } from "@vibly/coordinator-http-contract/types";

export type KnownPath = keyof paths;

/**
 * Identity helper that constrains the path literal to be a documented
 * coordinator path. Returns the same string at runtime.
 */
export function path<P extends KnownPath>(p: P): P {
  return p;
}
