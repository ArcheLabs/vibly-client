import { afterEach, describe, expect, it, vi } from "vitest";
import { CoordinatorClient } from "../../src/coordinator/client.js";

const client = () => new CoordinatorClient({ baseUrl: "http://coordinator.test", token: "dev-token", maxRetries: 0 });

describe("CoordinatorClient governance reads", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists merged governance views with backend filter", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
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
      ),
    );

    const result = await client().listGovernanceMerged({
      projectId: "project_1",
      backend: "evm-governor",
      limit: 10,
    });

    expect(result.items).toHaveLength(1);
    expect(fetch).toHaveBeenCalledWith(
      "http://coordinator.test/governance/merged?projectId=project_1&backend=evm-governor&limit=10",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer dev-token" }) }),
    );
  });

  it("lists governance subjects with backend filter", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          ok: true,
          data: { items: [{ id: "eip155:31337:prop_evm_1", backend: "evm-governor" }] },
        }),
      ),
    );

    const result = await client().listGovernanceSubjects({ backend: "evm-governor", limit: 5 });

    expect(result.items).toEqual([{ id: "eip155:31337:prop_evm_1", backend: "evm-governor" }]);
    expect(fetch).toHaveBeenCalledWith(
      "http://coordinator.test/governance/subjects?backend=evm-governor&limit=5",
      expect.anything(),
    );
  });

  it("reads checkpoint by backend", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          ok: true,
          data: { checkpoint: { id: "checkpoint:eip155:31337" }, items: [{ id: "checkpoint:eip155:31337" }] },
        }),
      ),
    );

    const result = await client().getGovernanceCheckpoint({ backend: "evm-governor" });

    expect(result.checkpoint).toEqual({ id: "checkpoint:eip155:31337" });
    expect(fetch).toHaveBeenCalledWith(
      "http://coordinator.test/governance/checkpoint?backend=evm-governor",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("lists governance backends with health state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
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
      ),
    );

    const result = await client().listGovernanceBackends();

    expect(result.items).toEqual([
      {
        id: "evm-fixture",
        backend: "evm-governor",
        health: { status: "stale", stale: true, reason: "checkpoint_age_exceeds_threshold" },
      },
    ]);
    expect(fetch).toHaveBeenCalledWith(
      "http://coordinator.test/governance/backends",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("submits an OpenGov intent through the coordinator", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          ok: true,
          data: { receipt: { tx: { txHash: "0xsubmit" }, readbackStatus: "pending_indexer" } },
        }),
      ),
    );

    const result = await client().submitGovernanceOpenGov("intent-1", {
      actor: "5Alice",
      submitArgs: { proposal: "0xproposal" },
    });

    expect(result).toEqual({ receipt: { tx: { txHash: "0xsubmit" }, readbackStatus: "pending_indexer" } });
    expect(fetch).toHaveBeenCalledWith(
      "http://coordinator.test/governance/intents/intent-1/submit-opengov",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
