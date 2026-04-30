/**
 * Minimal helpers for obtaining a PAPI PolkadotSigner from a dev account URI
 * or a hex private key.  Used exclusively by the governance CLI commands.
 *
 * The signer is always derived at call-time (no global state).
 */

export interface ChainSignerOptions {
  /** WebSocket RPC endpoint of the Substrate node. */
  rpcUrl: string;
  /** Dev account URI (e.g. "//Alice") or a raw hex private key. */
  signerUri: string;
  /** Human-readable chain identifier stored in ChainRef.chainId. */
  chainId: string;
}

/**
 * Reads governance-related chain config from environment variables,
 * with CLI option overrides applied on top.
 */
export function resolveChainSignerOptions(overrides: Partial<ChainSignerOptions> = {}): ChainSignerOptions {
  return {
    rpcUrl: overrides.rpcUrl ?? process.env["VIBLY_CHAIN_RPC_URL"] ?? "ws://127.0.0.1:9944",
    signerUri: overrides.signerUri ?? process.env["VIBLY_CHAIN_SIGNER_URI"] ?? "//Alice",
    chainId: overrides.chainId ?? process.env["VIBLY_CHAIN_ID"] ?? "substrate:vibly-solo",
  };
}
