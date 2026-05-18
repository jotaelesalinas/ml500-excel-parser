import { FirstNFilter } from "../src/core/FirstNFilter.js";

describe("FirstNFilter", () => {
  it("keeps only first N entries per buy date", () => {
    const filter = new FirstNFilter();
    const input = [
      { fechac: "2026-01-01", ticker: "A" },
      { fechac: "2026-01-01", ticker: "B" },
      { fechac: "2026-01-01", ticker: "C" },
      { fechac: "2026-01-02", ticker: "D" },
      { fechac: "2026-01-02", ticker: "E" },
    ];

    const output = filter.filter(input, 2);

    expect(output.map((entry) => entry.ticker)).toEqual(["A", "B", "D", "E"]);
  });

  it("returns all entries when N is larger than available entries", () => {
    const filter = new FirstNFilter();
    const input = [
      { fechac: "2026-01-01", ticker: "A" },
      { fechac: "2026-01-01", ticker: "B" },
    ];

    const output = filter.filter(input, 100);

    expect(output.map((entry) => entry.ticker)).toEqual(["A", "B"]);
  });

  it("returns empty array for empty input", () => {
    const filter = new FirstNFilter();
    expect(filter.filter([], 5)).toEqual([]);
  });
});
