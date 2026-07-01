import { createResultKeyRegistry } from "../../src/ui/results/resultKeyRegistry.js";

describe("createResultKeyRegistry", () => {
  it("returns stable keys for the same result object", () => {
    const registry = createResultKeyRegistry();
    const result = { top_n: 4, tab: "Tab A" };

    expect(registry.getKey(result)).toBe(registry.getKey(result));
  });

  it("returns different keys for different objects", () => {
    const registry = createResultKeyRegistry();

    expect(registry.getKey({ top_n: 4, tab: "Tab A" })).not.toBe(
      registry.getKey({ top_n: 4, tab: "Tab A" }),
    );
  });
});
