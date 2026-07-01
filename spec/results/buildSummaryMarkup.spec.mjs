import { buildSummaryMarkup } from "../../src/ui/results/buildSummaryMarkup.js";

describe("buildSummaryMarkup", () => {
  it("renders summary boxes for numeric metrics", () => {
    const markup = buildSummaryMarkup([
      { tab: "Tab A", strat: "Fixed D", top_n: 4, returns: 10, avg_age_y: 1.2, XIRR: 12 },
      { tab: "Tab B", strat: "Fixed D", top_n: 4, returns: 20, avg_age_y: 2.2, XIRR: 15 },
    ]);

    expect(markup).toContain("Min · Avg · Max P/L %");
    expect(markup).toContain("+10.00 %");
    expect(markup).toContain("Max: Tab B · Fixed D · Top 4");
  });
});
