import { describe, it, expect } from "vitest";

describe("Phase 0 sanity — Vitest", () => {
  it("runs a trivial assertion", () => {
    expect(1 + 1).toBe(2);
  });

  it("can resolve the @/ path alias to src", async () => {
    // Importing a real module proves vitest.config.ts alias is wired up.
    // The import itself is the assertion — if alias is broken, this throws.
    const mod = await import("@/types/program");
    expect(mod).toBeDefined();
  });
});
