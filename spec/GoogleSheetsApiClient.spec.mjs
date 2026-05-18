import { GoogleSheetsApiClient } from "../src/core/GoogleSheetsApiClient.js";

describe("GoogleSheetsApiClient", () => {
  it("fetches sheet tabs", async () => {
    const fetchFn = jasmine.createSpy("fetchFn").and.resolveTo({
      ok: true,
      json: async () => ({
        sheets: [
          { properties: { title: "A" } },
          { properties: { title: "B" } },
        ],
      }),
    });

    const client = new GoogleSheetsApiClient(fetchFn);
    const tabs = await client.fetchSheetTabs("sheet-id", "api-key");

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn.calls.mostRecent().args[0]).toContain("/spreadsheets/sheet-id?");
    expect(tabs).toEqual(["A", "B"]);
  });

  it("throws with API body when tabs request fails", async () => {
    const fetchFn = jasmine.createSpy("fetchFn").and.resolveTo({
      ok: false,
      status: 403,
      text: async () => "forbidden",
    });

    const client = new GoogleSheetsApiClient(fetchFn);

    await expectAsync(client.fetchSheetTabs("sheet-id", "api-key")).toBeRejectedWithError(
      "Failed to fetch spreadsheet metadata (403): forbidden",
    );
  });

  it("fetches sheet values", async () => {
    const fetchFn = jasmine.createSpy("fetchFn").and.resolveTo({
      ok: true,
      json: async () => ({ values: [["h1"], ["v1"]] }),
    });

    const client = new GoogleSheetsApiClient(fetchFn);
    const values = await client.fetchSheetValues("sheet-id", "Tab 1", "api-key");

    expect(fetchFn.calls.mostRecent().args[0]).toContain("/values/Tab%201");
    expect(values).toEqual([["h1"], ["v1"]]);
  });
});
