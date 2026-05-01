# vibly-client — Agent Operating Rules

This file lists invariants every Cursor agent (and human contributor) must obey when working in `vibly-client`. Violations should block PRs.

## Role

`vibly-client` is the Vibly Agent CLI (`vibly`). It calls the coordinator HTTP API with CLI-only transport policy: Bearer token auth, `Idempotency-Key`, GET retry with exponential backoff, request timeout. It is **not** the HTTP contract owner — `vibly-coordinator` is, via `@vibly/coordinator-http-contract`.

## Invariants

1. **New paths MUST come from the contract.** `src/coordinator/client.ts` is 100% contract-backed and must call `this.contract.METHOD("/typed/path", { params, body })`. Keep path literals constrained by `path("/...")` in `src/coordinator/contractPaths.ts` when a literal must be assembled (e.g. SSE URL helpers).
2. **Do not duplicate response shapes from the contract.** Prefer importing projections from `@vibly/coordinator-http-contract/types` (`paths['/...']['get']['responses']['200']['content']['application/json']`) over growing hand-written DTOs in `src/coordinator/types.ts`.
3. **CLI transport policy lives in `src/coordinator/contractClient.ts`.** Bearer auth, GET retry/backoff, and `Idempotency-Key` behavior are wired through openapi-fetch's custom `fetch` + per-call headers. Do not reintroduce a parallel `fetch` stack in `CoordinatorClient`.
4. **Handwritten coordinator paths are lint-blocked.** `scripts/check-handwritten-paths.mjs` scans `src/` and only allows transport-level path assembly in `src/coordinator/sse.ts` and `src/coordinator/contractClient.ts`.

## When in doubt

- Method needs a new field on response? Update coordinator's route schema, dump openapi, regenerate types, then update the CLI command.
- Method needs to keep working before coordinator catches up? Use `path("/known")` for typed paths and keep a comment pointing to the follow-up to migrate the response type.
