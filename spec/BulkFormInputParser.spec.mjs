import { BulkFormInputParser } from "../src/parsers/BulkFormInputParser.js";

describe("BulkFormInputParser", () => {
  it("parses the first 3 non-empty trimmed lines", () => {
    const parser = new BulkFormInputParser();

    const parsed = parser.parse("  https://docs.google.com/spreadsheets/d/abc/edit \n\n  key-1 \n 4, 10 \n");

    expect(parsed).toEqual({
      spreadsheetUrl: "https://docs.google.com/spreadsheets/d/abc/edit",
      apiKey: "key-1",
      firstN: "4, 10",
      minDeposit: "",
      minInvestment: "",
      reinvest: null,
      incremental: null,
    });
  });

  it("returns empty values when text has fewer lines", () => {
    const parser = new BulkFormInputParser();

    const parsed = parser.parse("only-url");

    expect(parsed).toEqual({
      spreadsheetUrl: "only-url",
      apiKey: "",
      firstN: "",
      minDeposit: "",
      minInvestment: "",
      reinvest: null,
      incremental: null,
    });
  });

  it("parses optional strategy lines", () => {
    const parser = new BulkFormInputParser();

    const parsed = parser.parse("url\nkey\n5\n1000\n200\ntrue\nyes");

    expect(parsed).toEqual({
      spreadsheetUrl: "url",
      apiKey: "key",
      firstN: "5",
      minDeposit: "1000",
      minInvestment: "200",
      reinvest: true,
      incremental: true,
    });
  });
});
