/**
 * Chain-level identity and agent-onboarding transactions.
 *
 * Covers pallet_identity_core and pallet_onboarding_distribution calls that
 * are needed to bootstrap an agent from scratch on a dev chain:
 *
 *  1. register_identity       → produces an IdentityId (H256)
 *  2. set_agent_registrar     → authorises a separate account to register agents
 *  3. register_agent          → produces a chain AgentId (H256)
 *
 * The module follows the same pattern as agentStaking.ts:
 * – dynamic imports for @polkadot/* to avoid ESM circular-dep issues
 * – events are parsed from result.events inside the signAndSend callback
 */

import { resolveChainSignerOptions } from "./signer.js";
import type { ChainSignerOptions } from "./signer.js";

// ── Public types ─────────────────────────────────────────────────────────────

export type IdentityOnboardingTxKind =
  | "register-identity"
  | "set-agent-registrar"
  | "register-agent";

export interface RegisterIdentityInput {
  kind: "register-identity";
  signer?: Partial<ChainSignerOptions>;
}

export interface SetAgentRegistrarInput {
  kind: "set-agent-registrar";
  identityId: string;
  /** AccountId (SS58 or hex) of the account to authorise as registrar. */
  registrarKey: string;
  signer?: Partial<ChainSignerOptions>;
}

export interface RegisterAgentInput {
  kind: "register-agent";
  identityId: string;
  /**
   * ContentRef for the agent, encoded as one of:
   *   "hash:0x<64-hex-chars>"  →  ContentRef::Hash(H256)
   *   "uri:<any-uri>"          →  ContentRef::Uri(...)
   */
  agentRef: string;
  signer?: Partial<ChainSignerOptions>;
}

export type IdentityOnboardingInput =
  | RegisterIdentityInput
  | SetAgentRegistrarInput
  | RegisterAgentInput;

export interface IdentityOnboardingReceipt {
  txHash: string;
  chainId: string;
  rpcUrl: string;
  extrinsic: IdentityOnboardingTxKind;
  /** Set after register-identity — hex-encoded H256. */
  identityId?: string;
  /** Set after register-agent — hex-encoded H256. */
  agentId?: string;
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function submitIdentityOnboardingTx(
  input: IdentityOnboardingInput,
): Promise<IdentityOnboardingReceipt> {
  const signerOptions = resolveChainSignerOptions(input.signer);

  const [apiModule, keyringModule, cryptoModule] = await Promise.all([
    dynamicImport("@polkadot/api"),
    dynamicImport("@polkadot/keyring"),
    dynamicImport("@polkadot/util-crypto"),
  ]);

  const { ApiPromise, WsProvider } = apiModule as {
    ApiPromise: { create: (opts: { provider: unknown }) => Promise<ChainApi> };
    WsProvider: new (url: string) => unknown;
  };
  const { Keyring } = keyringModule as {
    Keyring: new (opts: { type: "sr25519" }) => {
      addFromUri: (uri: string) => unknown;
    };
  };
  const { cryptoWaitReady } = cryptoModule as {
    cryptoWaitReady: () => Promise<void>;
  };

  await cryptoWaitReady();
  const api = await ApiPromise.create({ provider: new WsProvider(signerOptions.rpcUrl) });

  try {
    const keyring = new Keyring({ type: "sr25519" });
    const signer = keyring.addFromUri(signerOptions.signerUri);
    const tx = buildTx(api, input);

    let identityId: string | undefined;
    let agentId: string | undefined;

    const txHash = await new Promise<string>((resolve, reject) => {
      void tx
        .signAndSend(signer, (result: SignAndSendResult) => {
          if (result.dispatchError) {
            reject(new Error(`dispatchError: ${result.dispatchError.toString()}`));
            return;
          }
          if (result.status.isInBlock || result.status.isFinalized) {
            // Parse events to extract identityId / agentId.
            for (const { event } of result.events ?? []) {
              const section = String(event.section);
              const method = String(event.method);

              if (section === "identityCore" && method === "IdentityRegistered") {
                // event.data[0] = identity_id: H256
                identityId = hexOf(event.data[0]);
              }
              if (
                section === "onboardingDistribution" &&
                method === "AgentRegistered"
              ) {
                // event.data[0] = identity_id, event.data[1] = agent_id: H256
                agentId = hexOf(event.data[1]);
              }
            }
            resolve(tx.hash.toHex());
          }
        })
        .catch(reject);
    });

    return {
      txHash,
      chainId: signerOptions.chainId,
      rpcUrl: signerOptions.rpcUrl,
      extrinsic: input.kind,
      identityId,
      agentId,
    };
  } finally {
    await api.disconnect();
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function buildTx(api: ChainApi, input: IdentityOnboardingInput): ChainTx {
  switch (input.kind) {
    case "register-identity":
      // register_identity(recovery_key?, extra_keys?, profile?, agent_registry?, auth_registry?)
      // All optional — pass nulls for a bare identity.
      return api.tx.identityCore.registerIdentity(null, null, null, null, null);

    case "set-agent-registrar":
      return api.tx.onboardingDistribution.setAgentRegistrar(
        input.identityId,
        input.registrarKey,
      );

    case "register-agent":
      return api.tx.onboardingDistribution.registerAgent(
        input.identityId,
        encodeAgentRef(input.agentRef),
      );
  }
}

/**
 * Parse an agentRef string into the ContentRef enum object expected by
 * polkadot.js:
 *   "hash:0x…"  →  { Hash: "0x…" }
 *   "uri:…"     →  { Uri: "…" }
 */
function encodeAgentRef(agentRef: string): Record<string, string> {
  if (agentRef.startsWith("hash:")) {
    return { Hash: agentRef.slice(5) };
  }
  if (agentRef.startsWith("uri:")) {
    return { Uri: agentRef.slice(4) };
  }
  // Bare hex fallback (backward-compat).
  if (agentRef.startsWith("0x")) {
    return { Hash: agentRef };
  }
  throw new Error(
    `Invalid agentRef format "${agentRef}". Use "hash:0x<64hex>" or "uri:<uri>".`,
  );
}

function hexOf(codecValue: unknown): string {
  if (
    codecValue &&
    typeof codecValue === "object" &&
    "toHex" in codecValue &&
    typeof (codecValue as { toHex: unknown }).toHex === "function"
  ) {
    return (codecValue as { toHex: () => string }).toHex();
  }
  return String(codecValue);
}

function dynamicImport(
  specifier: string,
): Promise<Record<string, unknown>> {
  const loader = new Function(
    "specifier",
    "return import(specifier)",
  ) as (value: string) => Promise<Record<string, unknown>>;
  return loader(specifier);
}

// ── Minimal polkadot types (avoids importing @polkadot/api at module level) ──

type SignAndSendResult = {
  dispatchError?: { toString: () => string };
  status: { isInBlock: boolean; isFinalized: boolean };
  events?: { event: PalletEvent }[];
};

type PalletEvent = {
  section: unknown;
  method: unknown;
  data: unknown[] & { [index: number]: unknown };
};

type ChainTx = {
  hash: { toHex: () => string };
  signAndSend: (
    signer: unknown,
    callback: (result: SignAndSendResult) => void,
  ) => Promise<() => void>;
};

type ChainApi = {
  tx: {
    identityCore: {
      registerIdentity: (
        recoveryKey: null,
        extraKeys: null,
        profile: null,
        agentRegistry: null,
        authRegistry: null,
      ) => ChainTx;
    };
    onboardingDistribution: {
      setAgentRegistrar: (identityId: string, registrarKey: string) => ChainTx;
      registerAgent: (
        identityId: string,
        agentRef: Record<string, string>,
      ) => ChainTx;
    };
  };
  disconnect: () => Promise<void>;
};
