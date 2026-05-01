# vibly-client — Agent Operating Rules

This file lists invariants every Cursor agent (and human contributor) must obey when working in `vibly-client`. Violations should block PRs.

## Role

`vibly-client` is the Vibly Agent CLI (`vibly`). It calls the coordinator HTTP API with CLI-only transport policy: Bearer token auth, `Idempotency-Key`, GET retry with exponential backoff, request timeout. It is **not** the HTTP contract owner — `vibly-coordinator` is, via `@vibly/coordinator-http-contract`.

## Invariants

1. **New paths MUST come from the contract.** Use `path("/...")` from `src/coordinator/contractPaths.ts` to type-constrain the literal against `@vibly/coordinator-http-contract`'s `paths`. Adding a new entry to `src/coordinator/routes.ts` is allowed only if the corresponding coordinator route does not yet exist; in that case, file a follow-up to add the route + schema in coordinator and migrate the constant to `path("/...")`.
2. **Do not duplicate response shapes from the contract.** When migrating a method, prefer importing `paths['/...']['get']['responses']['200']['content']['application/json']` from `@vibly/coordinator-http-contract/types` over hand-written DTOs in `src/coordinator/types.ts`. The CLI may keep its own internal models for state that is purely client-side.
3. **CLI transport policy stays in `CoordinatorClient.request()`.** The contract package does not know about retries, timeouts, or idempotency. Migration to the contract client (when it happens for read-only paths) must wire those concerns through openapi-fetch's custom `fetch` option, not delete them.

## When in doubt

- Method needs a new field on response? Update coordinator's route schema, dump openapi, regenerate types, then update the CLI command.
- Method needs to keep working before coordinator catches up? Use `path("/known")` for typed paths and keep a comment pointing to the follow-up to migrate the response type.
