export type Result<T, E = ClientError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function err<E = ClientError>(error: E): Result<never, E> {
  return { ok: false, error };
}

import type { ClientError } from "./errors.js";
