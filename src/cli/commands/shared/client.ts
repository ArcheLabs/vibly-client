import { CoordinatorClient } from "../../../coordinator/client.js";
import { loadActiveProfile, requireApiToken } from "../../../config/profiles.js";
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
  const client = new CoordinatorClient({ baseUrl: profile.coordinatorUrl, token });
  return { client, config, profile };
}
