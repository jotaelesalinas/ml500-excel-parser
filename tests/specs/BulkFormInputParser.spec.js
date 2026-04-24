import { BulkFormInputParser } from "../../src/parsers/SpreadsheetInputParser.js";

describe("BulkFormInputParser", () => {
    it("extracts the first three non-empty trimmed lines", () => {
        const parser = new BulkFormInputParser();

        const result = parser.parse(`
            https://docs.google.com/spreadsheets/d/abc123/edit

              API_KEY_123

            4, 10
        `);

        expect(result).toEqual({
            spreadsheetUrl: "https://docs.google.com/spreadsheets/d/abc123/edit",
            apiKey: "API_KEY_123",
            firstN: "4, 10",
        });
    });
});
