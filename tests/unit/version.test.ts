import { afterEach, describe, expect, it } from "vitest";
import { clientVersionHeaderValues, clientVersionHeaders } from "../../src/version.js";

describe("client version headers", () => {
  afterEach(() => {
    delete process.env["VIBLY_CLIENT_VERSION"];
    delete process.env["VIBLY_CONTRACT_VERSION"];
    delete process.env["VIBLY_PROTOCOL_VERSION"];
  });

  it("uses package defaults for coordinator client headers", () => {
    expect(clientVersionHeaderValues()).toEqual({
      packageName: "@vibly-ai/client",
      clientVersion: "0.1.1",
      contractVersion: "0.1.1",
      protocolVersion: "0.2",
    });
  });

  it("allows env overrides for version headers", () => {
    process.env["VIBLY_CLIENT_VERSION"] = "9.8.7";
    process.env["VIBLY_CONTRACT_VERSION"] = "6.5.4";
    process.env["VIBLY_PROTOCOL_VERSION"] = "0.3";

    expect(clientVersionHeaders()).toMatchObject({
      "x-vibly-client-version": "9.8.7",
      "x-vibly-contract-version": "6.5.4",
      "x-vibly-protocol-version": "0.3",
      "x-vibly-client-package": "@vibly-ai/client",
    });
  });
});
