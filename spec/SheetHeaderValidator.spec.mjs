import { SheetHeaderValidator } from "../src/core/SheetHeaderValidator.js";

describe("SheetHeaderValidator", () => {
  it("accepts headers when required fields exist", () => {
    const validator = new SheetHeaderValidator(["ticker", "nombre", "fechac"]);
    const rows = [[" Ticker ", "Nombre", "FechaC", "Other"]];

    expect(validator.hasProcessableHeaders(rows)).toBeTrue();
  });

  it("rejects headers when one required field is missing", () => {
    const validator = new SheetHeaderValidator(["ticker", "nombre", "fechac"]);
    const rows = [["Ticker", "Nombre"]];

    expect(validator.hasProcessableHeaders(rows)).toBeFalse();
  });

  it("rejects empty rows", () => {
    const validator = new SheetHeaderValidator(["ticker"]);

    expect(validator.hasProcessableHeaders([])).toBeFalse();
  });
});
