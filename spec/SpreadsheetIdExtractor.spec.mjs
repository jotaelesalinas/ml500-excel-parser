import { SpreadsheetIdExtractor } from "../src/core/SpreadsheetIdExtractor.js";

describe("SpreadsheetIdExtractor", () => {
  it("extracts spreadsheet id from a valid URL", () => {
    const extractor = new SpreadsheetIdExtractor();
    const url = "https://docs.google.com/spreadsheets/d/abc123_XYZ/edit#gid=0";

    expect(extractor.extract(url)).toBe("abc123_XYZ");
  });

  it("throws when URL has no spreadsheet id", () => {
    const extractor = new SpreadsheetIdExtractor();

    expect(() => extractor.extract("https://example.com")).toThrowError(
      "Could not extract spreadsheet ID from URL.",
    );
  });
});
