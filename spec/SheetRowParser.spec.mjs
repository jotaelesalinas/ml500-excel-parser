import { SheetRowParser } from "../src/core/SheetRowParser.js";

describe("SheetRowParser", () => {
  const parser = new SheetRowParser(["ticker", "nombre", "fechac", "cantidad", "precioc"]);

  it("maps rows using header names", () => {
    const rows = [
      ["Nombre", "Ticker", "PrecioC", "Cantidad", "FechaC"],
      ["Apple", "AAPL", "100", "2", "2026-01-01"],
    ];

    const parsed = parser.parse(rows);

    expect(parsed).toEqual([
      {
        ticker: "AAPL",
        nombre: "Apple",
        fechac: "2026-01-01",
        cantidad: "2",
        precioc: "100",
      },
    ]);
  });

  it("returns empty array when there is no data row", () => {
    expect(parser.parse([["Ticker"]])).toEqual([]);
  });

  it("returns empty array when rows is empty", () => {
    expect(parser.parse([])).toEqual([]);
  });

  it("returns empty string for columns not present in the sheet", () => {
    const rows = [
      ["Ticker"],
      ["AAPL"],
    ];

    const parsed = parser.parse(rows);

    expect(parsed[0].ticker).toBe("AAPL");
    expect(parsed[0].nombre).toBe("");
    expect(parsed[0].fechac).toBe("");
  });

  it("handles rows shorter than the header", () => {
    const rows = [
      ["Ticker", "Nombre", "FechaC", "Cantidad", "PrecioC"],
      ["AAPL"],
    ];

    const parsed = parser.parse(rows);

    expect(parsed[0].ticker).toBe("AAPL");
    expect(parsed[0].precioc).toBe("");
  });

  it("filters entries without ticker", () => {
    const rows = [
      ["Ticker", "Nombre", "FechaC", "Cantidad", "PrecioC"],
      ["", "No ticker", "2026-01-01", "1", "10"],
      ["MSFT", "Microsoft", "2026-01-01", "2", "20"],
    ];

    const parsed = parser.parse(rows);

    expect(parsed.length).toBe(1);
    expect(parsed[0].ticker).toBe("MSFT");
  });
});
