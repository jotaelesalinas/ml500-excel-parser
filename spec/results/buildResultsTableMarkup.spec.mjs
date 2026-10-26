import { buildResultsTableMarkup } from "../../src/ui/results/buildResultsTableMarkup.js";

describe("buildResultsTableMarkup", () => {
  const registry = { getKey: () => "key-1" };
  const sortState = { field: null, direction: "asc", hasSorted: false };

  function baseResult(overrides) {
    return {
      top_n: 4,
      tab: "Tab A",
      strat: "Fixed D",
      XIRR: 12.34,
      avg_age_y: 1.2,
      deposited: 2000,
      current: 2200,
      invested: 1500,
      depositCash: 300,
      saleCash: 200,
      returns: 10,
      ...overrides,
    };
  }

  it("marks closed portfolios with a dot showing the closing date", () => {
    const markup = buildResultsTableMarkup(
      [baseResult({ closed: true, asOf: "2026-03-01" })],
      sortState,
      registry,
    );

    expect(markup).toContain("class=\"closed-dot\"");
    expect(markup).toContain("Closed on 2026-03-01");
  });

  it("does not mark open portfolios", () => {
    const markup = buildResultsTableMarkup(
      [baseResult({ closed: false, asOf: "2026-09-03" })],
      sortState,
      registry,
    );

    expect(markup).not.toContain("closed-dot");
  });
});
