import { describe, it, expect } from "vitest";
import { loadConfig } from "../../src/config/config.js";

describe("loadConfig", () => {
  it("returns default config when no file exists", () => {
    // Use a path that definitely doesn't exist
    const config = loadConfig("/tmp/__vibly_nonexistent_test_config__.json");
    expect(config.version).toBe("0.1.0");
    expect(config.profiles).toBeDefined();
    expect(typeof config.profiles).toBe("object");
  });
});
