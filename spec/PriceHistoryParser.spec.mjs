import { PriceHistoryParser } from "../src/core/PriceHistoryParser.js";

describe("PriceHistoryParser", () => {
  it("reads one price column per ticker against the shared date column", () => {
    const { seriesByTicker, issues } = new PriceHistoryParser().parse([
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
    expect(issues).toEqual([]);
  });

  it("normalizes the tickers in the header row", () => {
    const { seriesByTicker } = new PriceHistoryParser().parse([
      ["Fecha", "Día", " aapl ", "msft"],
      ["2025-04-03", "Thu", "203.19", "373.11"],
    ]);

    expect([...seriesByTicker.keys()]).toEqual(["AAPL", "MSFT"]);
  });

  it("ignores the weekday helper and the _SAMPLE_ template column", () => {
    const { seriesByTicker, issues } = new PriceHistoryParser().parse([
      ["Fecha", "Día", "_SAMPLE_", "A"],
      ["2023-01-03", "Tue", "#N/A", "150.04"],
    ]);

    expect([...seriesByTicker.keys()]).toEqual(["A"]);
    expect(issues).toEqual([]);
  });

  it("skips the days a ticker did not quote, such as weekends and holidays", () => {
    const { seriesByTicker, issues } = new PriceHistoryParser().parse([
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
    expect(issues).toEqual([]);
  });

  it("merges columns that repeat the same ticker", () => {
    const { seriesByTicker } = new PriceHistoryParser().parse([
      ["Fecha", "Día", "AAPL", "AAPL"],
      ["2025-04-03", "Thu", "203.19", "#N/A"],
      ["2025-04-04", "Fri", "#N/A", "188.38"],
    ]);

    expect(seriesByTicker.size).toBe(1);
    expect(seriesByTicker.get("AAPL").length).toBe(2);
  });

  it("reports a row whose date is not an ISO date and keeps the rest", () => {
    const { seriesByTicker, issues } = new PriceHistoryParser().parse([
      ["Fecha", "Día", "AAPL"],
      ["3/4/2025", "Thu", "203.19"],
      ["2025-04-04", "Fri", "188.38"],
      ["", "", ""],
    ]);

    expect(seriesByTicker.get("AAPL").sessions).toEqual([{ date: "2025-04-04", value: 188.38 }]);
    expect(issues).toEqual([
      '"Prices hist": row 2 holds "3/4/2025" under "Fecha" instead of a YYYY-MM-DD date; the row is ignored.',
    ]);
  });

  it("reports a price cell that is neither a number nor #N/A", () => {
    const { seriesByTicker, issues } = new PriceHistoryParser().parse([
      ["Fecha", "Día", "AAPL"],
      ["2025-04-03", "Thu", "203,19 USD"],
      ["2025-04-04", "Fri", "188.38"],
    ]);

    expect(seriesByTicker.get("AAPL").sessions).toEqual([{ date: "2025-04-04", value: 188.38 }]);
    expect(issues).toEqual([
      '"Prices hist": row 2 holds "203,19 USD" under AAPL instead of a price; the cell is ignored.',
    ]);
  });

  it("reports a ticker column with no price at all", () => {
    const { seriesByTicker, issues } = new PriceHistoryParser().parse([
      ["Fecha", "Día", "AAPL", "MSFT"],
      ["2025-04-03", "Thu", "203.19", "#N/A"],
    ]);

    expect(seriesByTicker.get("MSFT").isEmpty()).toBeTrue();
    expect(issues).toEqual(['"Prices hist": the MSFT column has no price at all.']);
  });

  it("counts the repeated problems instead of listing every row", () => {
    const badRows = Array.from({ length: 7 }, (_, index) => [`2025-04-0${index + 1}`, "Thu", "n.d."]);
    const { issues } = new PriceHistoryParser().parse([["Fecha", "Día", "AAPL"], ...badRows]);

    expect(issues.filter((issue) => issue.includes("instead of a price")).length).toBe(5);
    expect(issues).toContain('"Prices hist": and 2 more unreadable price cell(s).');
  });

  it("reports an empty tab, a header-only tab and a tab without the expected columns", () => {
    const layout = 'row 1 must hold "Fecha", the "Día" helper and then one column per ticker';

    expect(new PriceHistoryParser().parse([]).issues).toEqual([`"Prices hist": the tab is empty; ${layout}.`]);
    expect(new PriceHistoryParser().parse(null).seriesByTicker.size).toBe(0);
    expect(new PriceHistoryParser().parse([["Fecha", "Día", "AAPL"]]).issues).toEqual([
      '"Prices hist": the tab has a header row but no prices.',
    ]);
    expect(new PriceHistoryParser().parse([["AAPL", ""], ["2025-04-03", "203.19"]]).issues).toEqual([
      `"Prices hist": no "Fecha" column found; ${layout}.`,
    ]);
    expect(new PriceHistoryParser().parse([["Fecha", "Día"], ["2025-04-03", "Thu"]]).issues).toEqual([
      `"Prices hist": no ticker column found; ${layout}.`,
    ]);
  });
});
