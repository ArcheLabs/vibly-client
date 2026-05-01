import { afterEach, describe, expect, it, vi } from "vitest";
import { CoordinatorClient } from "../../src/coordinator/client.js";

const client = () => new CoordinatorClient({ baseUrl: "http://coordinator.test", token: "dev-token", maxRetries: 0 });

describe("CoordinatorClient governance reads", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists merged governance views with backend filter", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        ok: true,
        data: {
          items: [
            {
              id: "merged:eip155:31337:prop_evm_1",
              subject: { backend: "evm-governor" },
            },
          ],
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await client().listGovernanceMerged({
      projectId: "project_1",
      backend: "evm-governor",
      limit: 10,
    });

    expect(result.items).toHaveLength(1);
    const request = (fetchMock.mock.calls as unknown as Array<[Request]>)[0]?.[0];
    expect(request?.url).toContain("/governance/merged");
    expect(request?.url).toContain("projectId=project_1");
    expect(request?.url).toContain("backend=evm-governor");
    expect(request?.url).toContain("limit=10");
    expect(request?.headers.get("Authorization")).toBe("Bearer dev-token");
  });

  it("lists governance subjects with backend filter", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        ok: true,
        data: { items: [{ id: "eip155:31337:prop_evm_1", backend: "evm-governor" }] },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await client().listGovernanceSubjects({ backend: "evm-governor", limit: 5 });

    expect(result.items).toEqual([{ id: "eip155:31337:prop_evm_1", backend: "evm-governor" }]);
    const request = (fetchMock.mock.calls as unknown as Array<[Request]>)[0]?.[0];
    expect(request?.url).toContain("/governance/subjects");
    expect(request?.url).toContain("backend=evm-governor");
    expect(request?.url).toContain("limit=5");
  });

  it("reads checkpoint by backend", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        ok: true,
        data: { checkpoint: { id: "checkpoint:eip155:31337" }, items: [{ id: "checkpoint:eip155:31337" }] },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await client().getGovernanceCheckpoint({ backend: "evm-governor" });

    expect(result.checkpoint).toEqual({ id: "checkpoint:eip155:31337" });
    const request = (fetchMock.mock.calls as unknown as Array<[Request]>)[0]?.[0];
    expect(request?.url).toContain("/governance/checkpoint");
    expect(request?.url).toContain("backend=evm-governor");
    expect(request?.method).toBe("GET");
  });

  it("lists governance backends with health state", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        ok: true,
        data: {
          backends: [
            {
              id: "evm-fixture",
              backend: "evm-governor",
              health: { status: "stale", stale: true, reason: "checkpoint_age_exceeds_threshold" },
            },
          ],
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await client().listGovernanceBackends();

    expect(result.items).toEqual([
      {
        id: "evm-fixture",
        backend: "evm-governor",
        health: { status: "stale", stale: true, reason: "checkpoint_age_exceeds_threshold" },
      },
    ]);
    const request = (fetchMock.mock.calls as unknown as Array<[Request]>)[0]?.[0];
    expect(request?.url).toBe("http://coordinator.test/governance/backends");
    expect(request?.method).toBe("GET");
  });

  it("submits an OpenGov intent through the coordinator", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        ok: true,
        data: { receipt: { tx: { txHash: "0xsubmit" }, readbackStatus: "pending_indexer" } },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await client().submitGovernanceOpenGov("intent-1", {
      actor: "5Alice",
      submitArgs: { proposal: "0xproposal" },
    });

    expect(result).toEqual({ receipt: { tx: { txHash: "0xsubmit" }, readbackStatus: "pending_indexer" } });
    const request = (fetchMock.mock.calls as unknown as Array<[Request]>)[0]?.[0];
    expect(request?.url).toBe("http://coordinator.test/governance/intents/intent-1/submit-opengov");
    expect(request?.method).toBe("POST");
    expect(request?.headers.get("Idempotency-Key")).toBeTruthy();
  });
});
