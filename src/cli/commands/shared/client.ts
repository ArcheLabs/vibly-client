import { CoordinatorClient } from "../../../coordinator/client.js";
import { getNetworkProfile, loadActiveProfile, requireApiToken } from "../../../config/profiles.js";
import type { ClientConfig, ClientProfile } from "../../../domain/clientTypes.js";

export interface CliCoordinatorContext {
  client: CoordinatorClient;
  config: ClientConfig;
  profile: ClientProfile;
}

/**
 * Resolve the active profile + token and build a `CoordinatorClient`.
 * Replaces the repeated `getClient()` helper that lived inside every
 * command file before this consolidation.
 */
export function getCoordinatorClient(): CliCoordinatorContext {
  const { config, profile } = loadActiveProfile();
  const token = requireApiToken(profile);
  const network = getNetworkProfile(profile);
  const client = new CoordinatorClient({ baseUrl: network.coordinatorUrl, token, networkId: network.id });
  return { client, config, profile };
}
