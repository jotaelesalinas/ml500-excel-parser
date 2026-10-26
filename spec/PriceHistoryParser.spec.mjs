import { PriceHistoryParser } from "../src/core/PriceHistoryParser.js";

describe("PriceHistoryParser", () => {
  it("reads one date/price column pair per ticker", () => {
    const seriesByTicker = new PriceHistoryParser().parse([
      ["AAPL", "", "MSFT", ""],
      ["2025-04-03", "203.19", "2025-04-03", "373.11"],
      ["2025-04-04", "188.38", "2025-04-04", "359.84"],
    ]);

    expect([...seriesByTicker.keys()]).toEqual(["AAPL", "MSFT"]);
    expect(seriesByTicker.get("AAPL").sessions).toEqual([
      { date: "2025-04-03", value: 203.19 },
      { date: "2025-04-04", value: 188.38 },
    ]);
    expect(seriesByTicker.get("MSFT").sessions).toEqual([
      { date: "2025-04-03", value: 373.11 },
      { date: "2025-04-04", value: 359.84 },
    ]);
  });

  it("accepts the ticker on either cell of the pair and normalizes it", () => {
    const seriesByTicker = new PriceHistoryParser().parse([
      ["", " aapl ", "MSFT", "MSFT"],
      ["2025-04-03", "203.19", "2025-04-03", "373.11"],
    ]);

    expect([...seriesByTicker.keys()]).toEqual(["AAPL", "MSFT"]);
  });

  it("skips rows whose date is not an ISO date, such as a GOOGLEFINANCE header", () => {
    const seriesByTicker = new PriceHistoryParser().parse([
      ["AAPL", ""],
      ["Date", "Close"],
      ["3/4/2025", "203.19"],
      ["2025-04-04 16:00:00", "188.38"],
      ["2025-04-07", "#N/A"],
    ]);

    expect(seriesByTicker.get("AAPL").sessions).toEqual([{ date: "2025-04-04", value: 188.38 }]);
  });

  it("merges pairs that repeat the same ticker", () => {
    const seriesByTicker = new PriceHistoryParser().parse([
      ["AAPL", "", "AAPL", ""],
      ["2025-04-03", "203.19", "2025-04-04", "188.38"],
    ]);

    expect(seriesByTicker.size).toBe(1);
    expect(seriesByTicker.get("AAPL").length).toBe(2);
  });

  it("returns an empty map for an empty or header-only tab", () => {
    expect(new PriceHistoryParser().parse([]).size).toBe(0);
    expect(new PriceHistoryParser().parse([["AAPL", ""]]).size).toBe(0);
    expect(new PriceHistoryParser().parse(null).size).toBe(0);
  });
});
