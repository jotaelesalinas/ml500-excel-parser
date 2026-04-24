import { SpreadsheetIdExtractor, SheetRowParser } from "../../src/parsers/SpreadsheetInputParser.js";

describe("SpreadsheetIdExtractor", () => {
    it("extracts the spreadsheet id from a Google Sheets URL", () => {
        const extractor = new SpreadsheetIdExtractor();

        expect(extractor.extract("https://docs.google.com/spreadsheets/d/abc123_DEF-456/edit#gid=0")).toBe("abc123_DEF-456");
    });

    it("throws when the URL does not contain a spreadsheet id", () => {
        const extractor = new SpreadsheetIdExtractor();

        expect(() => extractor.extract("https://example.com/not-a-sheet")).toThrowError("Could not extract spreadsheet ID from URL.");
    });
});

describe("SheetRowParser", () => {
    it("maps rows using normalized headers and trims values", () => {
        const parser = new SheetRowParser();

        const result = parser.parse([
            [" Ticker ", "Nombre", "FechaC", "Cantidad", "PrecioC", "PrecioA"],
            [" AAA ", " Alpha ", "2024-01-01", "2", "100", "150"],
        ]);

        expect(result).toEqual([{
            ticker: "AAA",
            nombre: "Alpha",
            fechac: "2024-01-01",
            cantidad: "2",
            precioc: "100",
            fechav: "",
            preciov: "",
            precioa: "150",
        }]);
    });

    it("returns an empty array when there are not enough rows", () => {
        const parser = new SheetRowParser();

        expect(parser.parse([])).toEqual([]);
        expect(parser.parse([["Ticker"]])).toEqual([]);
    });

    it("filters out rows without ticker values", () => {
        const parser = new SheetRowParser();

        const result = parser.parse([
            ["Ticker", "Nombre", "FechaC", "Cantidad", "PrecioC", "PrecioA"],
            ["", "No ticker", "2024-01-01", "1", "10", "12"],
        ]);

        expect(result).toEqual([]);
    });
});
