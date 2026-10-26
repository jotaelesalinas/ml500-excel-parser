import { PriceHistoryParser } from "../src/core/PriceHistoryParser.js";

describe("PriceHistoryParser", () => {
  it("reads one price column per ticker against the shared date column", () => {
    const seriesByTicker = new PriceHistoryParser().parse([
      ["Fecha", "Día", "AAPL", "MSFT"],
      ["2025-04-03", "Thu", "203.19", "373.11"],
      ["2025-04-04", "Fri", "188.38", "359.84"],
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

  it("normalizes the tickers in the header row", () => {
    const seriesByTicker = new PriceHistoryParser().parse([
      ["Fecha", "Día", " aapl ", "msft"],
      ["2025-04-03", "Thu", "203.19", "373.11"],
    ]);

    expect([...seriesByTicker.keys()]).toEqual(["AAPL", "MSFT"]);
  });

  it("ignores the weekday helper and the _SAMPLE_ template column", () => {
    const seriesByTicker = new PriceHistoryParser().parse([
      ["Fecha", "Día", "_SAMPLE_", "A"],
      ["2023-01-03", "Tue", "#N/A", "150.04"],
    ]);

    expect([...seriesByTicker.keys()]).toEqual(["A"]);
  });

  it("skips the days a ticker did not quote, such as weekends and holidays", () => {
    const seriesByTicker = new PriceHistoryParser().parse([
      ["Fecha", "Día", "A", "AAPL"],
      ["2023-01-01", "Sun", "#N/A", "#N/A"],
      ["2023-01-03", "Tue", "150.04", "125.07"],
      ["2023-01-04", "Wed", "151.67", ""],
    ]);

    expect(seriesByTicker.get("A").sessions).toEqual([
      { date: "2023-01-03", value: 150.04 },
      { date: "2023-01-04", value: 151.67 },
    ]);
    expect(seriesByTicker.get("AAPL").sessions).toEqual([{ date: "2023-01-03", value: 125.07 }]);
  });

  it("skips rows whose date is not an ISO date", () => {
    const seriesByTicker = new PriceHistoryParser().parse([
      ["Fecha", "Día", "AAPL"],
      ["Date", "", "203.19"],
      ["3/4/2025", "Thu", "203.19"],
      ["2025-04-04 16:00:00", "Fri", "188.38"],
    ]);

    expect(seriesByTicker.get("AAPL").sessions).toEqual([{ date: "2025-04-04", value: 188.38 }]);
  });

  it("merges columns that repeat the same ticker", () => {
    const seriesByTicker = new PriceHistoryParser().parse([
      ["Fecha", "Día", "AAPL", "AAPL"],
      ["2025-04-03", "Thu", "203.19", "#N/A"],
      ["2025-04-04", "Fri", "#N/A", "188.38"],
    ]);

    expect(seriesByTicker.size).toBe(1);
    expect(seriesByTicker.get("AAPL").length).toBe(2);
  });

  it("returns an empty map for an empty tab, a header-only tab or a tab with no date column", () => {
    expect(new PriceHistoryParser().parse([]).size).toBe(0);
    expect(new PriceHistoryParser().parse([["Fecha", "Día", "AAPL"]]).size).toBe(0);
    expect(new PriceHistoryParser().parse([["AAPL", ""], ["2025-04-03", "203.19"]]).size).toBe(0);
    expect(new PriceHistoryParser().parse(null).size).toBe(0);
  });
});
