import { createParser } from "eventsource-parser";
import type { EventEnvelope } from "./types.js";

export interface SseOptions {
  /** URL of the SSE endpoint */
  url: string;
  /** Auth token */
  token: string;
  /** Called for each parsed event */
  onEvent: (event: EventEnvelope) => void | Promise<void>;
  /** Called on error/reconnect */
  onError?: (err: Error, attempt: number) => void;
  /** Called when connection is established */
  onConnect?: () => void;
  /** Signal to abort the stream */
  signal?: AbortSignal;
  /** Max reconnect delay in ms (default: 30000) */
  maxBackoffMs?: number;
}

export async function subscribeSse(opts: SseOptions): Promise<void> {
  const { url, token, onEvent, onError, onConnect, signal, maxBackoffMs = 30000 } = opts;
  let attempt = 0;
  let lastEventId: string | undefined;

  while (!signal?.aborted) {
    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        Accept: "text/event-stream",
        "Cache-Control": "no-cache",
      };
      if (lastEventId) headers["Last-Event-ID"] = lastEventId;

      const res = await fetch(url, { headers, signal });
      if (!res.ok || !res.body) {
        throw new Error(`SSE connection failed: HTTP ${res.status}`);
      }

      onConnect?.();
      attempt = 0;

      const parser = createParser({
        onEvent(ev) {
          if (ev.id) lastEventId = ev.id;
          if (ev.data && ev.data !== "[DONE]") {
            try {
              const envelope = JSON.parse(ev.data) as EventEnvelope;
              void onEvent(envelope);
            } catch {
              // ignore parse errors
            }
          }
        },
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (!signal?.aborted) {
        const { done, value } = await reader.read();
        if (done) break;
        parser.feed(decoder.decode(value, { stream: true }));
      }
    } catch (e) {
      if (signal?.aborted) break;
      const err = e instanceof Error ? e : new Error(String(e));
      onError?.(err, attempt);
      attempt++;
      const backoff = Math.min(500 * 2 ** attempt, maxBackoffMs);
      await sleep(backoff);
    }
  }
}

/** Async iterable version of SSE for use in CLI tail commands */
export async function* streamEvents(opts: Omit<SseOptions, "onEvent">): AsyncGenerator<EventEnvelope> {
  const queue: EventEnvelope[] = [];
  let resolve: (() => void) | undefined;
  let done = false;

  const controller = new AbortController();
  opts.signal?.addEventListener("abort", () => controller.abort());

  subscribeSse({
    ...opts,
    signal: controller.signal,
    onEvent: (ev) => {
      queue.push(ev);
      resolve?.();
    },
    onError: (err) => {
      opts.onError?.(err, 0);
    },
  }).then(() => {
    done = true;
    resolve?.();
  }).catch(() => {
    done = true;
    resolve?.();
  });

  while (!done || queue.length > 0) {
    if (queue.length === 0) {
      await new Promise<void>((r) => { resolve = r; });
      resolve = undefined;
    }
    while (queue.length > 0) {
      yield queue.shift()!;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
