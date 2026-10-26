import { IndexHistoryParser } from "../src/core/IndexHistoryParser.js";

describe("IndexHistoryParser", () => {
  // Same shape as the "Index hist" tab: a ticker column plus one Fecha/Día/Valor block
  // per year, with "#N/A" on the days the market was closed.
  const rows = [
    ["Ticker", "Fecha", "Día", "Valor", "Fecha", "Día", "Valor"],
    ["INDEXSP:.INX", "2023-01-01", "Sun", "#N/A", "2024-01-01", "Mon", "#N/A"],
    ["INDEXSP:.INX", "2023-01-02", "Mon", "#N/A", "2024-01-02", "Tue", "4,742.83"],
    ["INDEXSP:.INX", "2023-01-03", "Tue", "3,824.14", "2024-01-03", "Wed", "4,704.81"],
  ];

  it("merges every year block into a single chronological series", () => {
    const series = new IndexHistoryParser().parse(rows);

    expect(series.sessions).toEqual([
      { date: "2023-01-03", value: 3824.14 },
      { date: "2024-01-02", value: 4742.83 },
      { date: "2024-01-03", value: 4704.81 },
    ]);
  });

  it("ignores rows without a quoted value", () => {
    const series = new IndexHistoryParser().parse(rows);

    expect(series.sessionAtOrBefore("2023-01-02")).toBeNull();
  });

  it("locates columns by header, not by position", () => {
    const series = new IndexHistoryParser().parse([
      ["Valor", "Fecha", "Valor"],
      ["ignored", "2025-03-04", "5,778.15"],
    ]);

    expect(series.sessions).toEqual([{ date: "2025-03-04", value: 5778.15 }]);
  });

  it("returns an empty series for an empty or header-only tab", () => {
    expect(new IndexHistoryParser().parse([]).isEmpty()).toBeTrue();
    expect(new IndexHistoryParser().parse([["Ticker", "Fecha", "Valor"]]).isEmpty()).toBeTrue();
    expect(new IndexHistoryParser().parse(null).isEmpty()).toBeTrue();
  });
});
