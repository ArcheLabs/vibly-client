export const CLIENT_PACKAGE_NAME = "@vibly-ai/client";
export const CLIENT_VERSION = "0.1.0";
export const CONTRACT_VERSION = "0.1.0";
export const PROTOCOL_VERSION = "2026-06-01";

export function clientVersionHeaders(): Record<string, string> {
  return {
    "X-Vibly-Client-Package": CLIENT_PACKAGE_NAME,
    "X-Vibly-Client-Version": CLIENT_VERSION,
    "X-Vibly-Contract-Version": CONTRACT_VERSION,
    "X-Vibly-Protocol-Version": PROTOCOL_VERSION,
  };
}
