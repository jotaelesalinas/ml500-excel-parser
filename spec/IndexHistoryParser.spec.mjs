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
    const { series, issues } = new IndexHistoryParser().parse(rows);

    expect(series.sessions).toEqual([
      { date: "2023-01-03", value: 3824.14 },
      { date: "2024-01-02", value: 4742.83 },
      { date: "2024-01-03", value: 4704.81 },
    ]);
    expect(issues).toEqual([]);
  });

  it("ignores rows without a quoted value", () => {
    const { series } = new IndexHistoryParser().parse(rows);

    expect(series.sessionAtOrBefore("2023-01-02")).toBeNull();
  });

  it("locates columns by header, not by position", () => {
    const { series } = new IndexHistoryParser().parse([
      ["Valor", "Fecha", "Valor"],
      ["ignored", "2025-03-04", "5,778.15"],
    ]);

    expect(series.sessions).toEqual([{ date: "2025-03-04", value: 5778.15 }]);
  });

  it("reports an empty tab or one without a Fecha/Valor pair", () => {
    expect(new IndexHistoryParser().parse([]).issues).toEqual([
      '"Index hist": the tab is empty; row 1 must hold a "Fecha" column followed by a "Valor" column.',
    ]);
    expect(new IndexHistoryParser().parse(null).series.isEmpty()).toBeTrue();
    expect(new IndexHistoryParser().parse([["Ticker", "Valor"], ["INDEXSP:.INX", "1"]]).issues).toEqual([
      '"Index hist": no "Fecha"/"Valor" column pair found; row 1 must hold a "Fecha" column followed by a "Valor" column.',
    ]);
  });

  it("reports a header-only tab and one whose rows hold nothing readable", () => {
    const headerOnly = new IndexHistoryParser().parse([["Ticker", "Fecha", "Valor"]]);
    expect(headerOnly.series.isEmpty()).toBeTrue();
    expect(headerOnly.issues).toEqual([
      '"Index hist": no readable session found under the "Fecha"/"Valor" columns.',
    ]);

    const unreadable = new IndexHistoryParser().parse([
      ["Fecha", "Valor"],
      ["3/1/2025", "5,868.55"],
      ["2025-01-03", "n/d"],
    ]);
    expect(unreadable.series.isEmpty()).toBeTrue();
    expect(unreadable.issues).toEqual([
      '"Index hist": row 2 holds "3/1/2025" under "Fecha" instead of a YYYY-MM-DD date; the value is ignored.',
      '"Index hist": row 3 holds "n/d" under "Valor" instead of a number; the value is ignored.',
      '"Index hist": no readable session found under the "Fecha"/"Valor" columns.',
    ]);
  });

  it("counts the repeated problems instead of listing every row", () => {
    const badRows = Array.from({ length: 8 }, (_, index) => [`0${index + 1}/01/2025`, "100"]);
    const { issues } = new IndexHistoryParser().parse([["Fecha", "Valor"], ...badRows]);

    expect(issues.filter((issue) => issue.includes("instead of a YYYY-MM-DD date")).length).toBe(5);
    expect(issues).toContain('"Index hist": and 3 more cell(s) with an unusable date.');
  });
});
