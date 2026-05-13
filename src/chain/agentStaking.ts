import { resolveChainSignerOptions } from "./signer.js";
import type { ChainSignerOptions } from "./signer.js";

export type AgentStakeTxKind = "bond" | "request-unbond" | "cancel-unbond" | "release-unbond";

export interface AgentStakeTxInput {
  kind: AgentStakeTxKind;
  identityId: string;
  agentId: string;
  amount?: string;
  signer?: Partial<ChainSignerOptions>;
}

export interface AgentStakeTxReceipt {
  txHash: string;
  chainId: string;
  rpcUrl: string;
  extrinsic: string;
}

export async function submitAgentStakeTx(input: AgentStakeTxInput): Promise<AgentStakeTxReceipt> {
  const signerOptions = resolveChainSignerOptions(input.signer);
  const [apiModule, keyringModule, cryptoModule] = await Promise.all([
    dynamicImport("@polkadot/api"),
    dynamicImport("@polkadot/keyring"),
    dynamicImport("@polkadot/util-crypto"),
  ]);
  const { ApiPromise, WsProvider } = apiModule as {
    ApiPromise: { create: (options: { provider: unknown }) => Promise<ChainApi> };
    WsProvider: new (rpcUrl: string) => unknown;
  };
  const { Keyring } = keyringModule as {
    Keyring: new (options: { type: "sr25519" }) => { addFromUri: (uri: string) => unknown };
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
    const txHash = await new Promise<string>((resolve, reject) => {
      void tx.signAndSend(signer, (result) => {
        if (result.dispatchError) {
          reject(new Error(result.dispatchError.toString()));
          return;
        }
        if (result.status.isInBlock || result.status.isFinalized) {
          resolve(tx.hash.toHex());
        }
      }).catch(reject);
    });
    return {
      txHash,
      chainId: signerOptions.chainId,
      rpcUrl: signerOptions.rpcUrl,
      extrinsic: input.kind,
    };
  } finally {
    await api.disconnect();
  }
}

function buildTx(api: ChainApi, input: AgentStakeTxInput): ChainTx {
  switch (input.kind) {
    case "bond":
      if (!input.amount) throw new Error("bond requires --amount");
      return api.tx.agentStaking.bondAgent(input.identityId, input.agentId, input.amount);
    case "request-unbond":
      if (!input.amount) throw new Error("request-unbond requires --amount");
      return api.tx.agentStaking.requestUnbond(input.identityId, input.agentId, input.amount);
    case "cancel-unbond":
      return api.tx.agentStaking.cancelUnbond(input.identityId, input.agentId);
    case "release-unbond":
      return api.tx.agentStaking.releaseUnbond(input.identityId, input.agentId);
  }
}

function dynamicImport(specifier: string): Promise<Record<string, unknown>> {
  const loader = new Function("specifier", "return import(specifier)") as (value: string) => Promise<Record<string, unknown>>;
  return loader(specifier);
}

type ChainTx = {
  hash: { toHex: () => string };
  signAndSend: (
    signer: unknown,
    callback: (result: {
      dispatchError?: { toString: () => string };
      status: { isInBlock: boolean; isFinalized: boolean };
    }) => void,
  ) => Promise<() => void>;
};

type ChainApi = {
  tx: {
    agentStaking: {
      bondAgent: (identityId: string, agentId: string, amount: string) => ChainTx;
      requestUnbond: (identityId: string, agentId: string, amount: string) => ChainTx;
      cancelUnbond: (identityId: string, agentId: string) => ChainTx;
      releaseUnbond: (identityId: string, agentId: string) => ChainTx;
    };
  };
  disconnect: () => Promise<void>;
};
