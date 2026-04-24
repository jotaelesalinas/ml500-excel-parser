import { GoogleSheetsService } from "../../src/services/GoogleSheetsService.js";
import { AppConfig } from "../../src/config.js";

describe("GoogleSheetsService", () => {
    it("fetches configured tabs and parses only the available ones", async () => {
        const parser = { parse: jasmine.createSpy("parse").and.returnValues([{ ticker: "AAA" }], [{ ticker: "BBB" }]) };
        const fetchImpl = jasmine.createSpy("fetchImpl").and.callFake(async url => {
            if (url.includes("fields=sheets.properties.title")) {
                return okJsonResponse({
                    sheets: [
                        { properties: { title: AppConfig.tabNames[0] } },
                        { properties: { title: AppConfig.tabNames[2] } },
                    ],
                });
            }

            if (url.includes(encodeURIComponent(AppConfig.tabNames[0]))) {
                return okJsonResponse({ values: [["Ticker"], ["AAA"]] });
            }

            if (url.includes(encodeURIComponent(AppConfig.tabNames[2]))) {
                return okJsonResponse({ values: [["Ticker"], ["BBB"]] });
            }

            throw new Error(`Unexpected URL: ${url}`);
        });

        spyOn(console, "warn");

        const service = new GoogleSheetsService(parser, fetchImpl);
        const result = await service.fetchConfiguredTabs("spreadsheet-id", "api-key");

        expect(fetchImpl.calls.count()).toBe(3);
        expect(parser.parse.calls.count()).toBe(2);
        expect(result).toEqual([
            [{ ticker: "AAA" }],
            [],
            [{ ticker: "BBB" }],
        ]);
        expect(console.warn).toHaveBeenCalled();
    });

    it("throws when spreadsheet metadata fetch fails", async () => {
        const service = new GoogleSheetsService({}, async () => ({
            ok: false,
            status: 403,
            text: async () => "Forbidden",
        }));

        await expectAsync(service.fetchConfiguredTabs("spreadsheet-id", "api-key")).toBeRejectedWithError(
            "Failed to fetch spreadsheet metadata (403): Forbidden"
        );
    });

    it("throws when a sheet values fetch fails", async () => {
        const fetchImpl = jasmine.createSpy("fetchImpl").and.callFake(async url => {
            if (url.includes("fields=sheets.properties.title")) {
                return okJsonResponse({
                    sheets: [{ properties: { title: AppConfig.tabNames[0] } }],
                });
            }

            return {
                ok: false,
                status: 500,
                text: async () => "Server error",
            };
        });

        const service = new GoogleSheetsService({ parse: jasmine.createSpy("parse") }, fetchImpl);

        await expectAsync(service.fetchConfiguredTabs("spreadsheet-id", "api-key")).toBeRejectedWithError(
            `Failed to fetch sheet "${AppConfig.tabNames[0]}" (500): Server error`
        );
    });
});

function okJsonResponse(data) {
    return {
        ok: true,
        json: async () => data,
    };
}
