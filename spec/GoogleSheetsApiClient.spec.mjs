import { GoogleSheetsApiClient } from "../src/core/GoogleSheetsApiClient.js";

describe("GoogleSheetsApiClient", () => {
  it("uses global fetch when no fetch function is injected", async () => {
    const originalFetch = globalThis.fetch;
    const globalFetchSpy = jasmine.createSpy("fetch").and.resolveTo({
      ok: true,
      json: async () => ({
        sheets: [{ properties: { title: "Global" } }],
      }),
    });

    globalThis.fetch = globalFetchSpy;

    try {
      const client = new GoogleSheetsApiClient();
      const tabs = await client.fetchSheetTabs("sheet-id", "api-key");

      expect(globalFetchSpy).toHaveBeenCalledTimes(1);
      expect(tabs).toEqual(["Global"]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

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

  it("throws a friendly error for 403 on tabs request", async () => {
    const fetchFn = jasmine.createSpy("fetchFn").and.resolveTo({
      ok: false,
      status: 403,
      text: async () => "forbidden",
    });

    const client = new GoogleSheetsApiClient(fetchFn);

    await expectAsync(client.fetchSheetTabs("sheet-id", "api-key")).toBeRejectedWithError(
      /Access denied/,
    );
  });

  it("uses Google API error message when available", async () => {
    const fetchFn = jasmine.createSpy("fetchFn").and.resolveTo({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ error: { message: "API key not valid." } }),
    });

    const client = new GoogleSheetsApiClient(fetchFn);

    await expectAsync(client.fetchSheetTabs("sheet-id", "api-key")).toBeRejectedWithError(
      /API key not valid/,
    );
  });

  it("throws a friendly error for 404 on sheet values", async () => {
    const fetchFn = jasmine.createSpy("fetchFn").and.resolveTo({
      ok: false,
      status: 404,
      text: async () => "not found",
    });

    const client = new GoogleSheetsApiClient(fetchFn);

    await expectAsync(client.fetchSheetValues("sheet-id", "Tab 1", "api-key")).toBeRejectedWithError(
      /Not found/,
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
