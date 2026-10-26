import { ProcessableTabsService } from "../src/services/ProcessableTabsService.js";
import { IndexHistoryParser } from "../src/core/IndexHistoryParser.js";
import { PriceHistoryParser } from "../src/core/PriceHistoryParser.js";

describe("ProcessableTabsService", () => {
  it("returns only processable tabs", async () => {
    const sheetsApiClient = {
      fetchSheetTabs: jasmine.createSpy("fetchSheetTabs").and.resolveTo(["Valid", "Invalid"]),
      fetchSheetValues: jasmine
        .createSpy("fetchSheetValues")
        .and.callFake(async (_spreadsheetId, tabName) => [[tabName], ["row"]]),
    };

    const headerValidator = {
      requiredFieldSlugs: ["ticker"],
      hasProcessableHeaders: jasmine
        .createSpy("hasProcessableHeaders")
        .and.callFake((rows) => rows[0][0] === "Valid"),
    };

    const rowParser = {
      parse: jasmine.createSpy("parse").and.returnValue([{ ticker: "AAPL" }]),
    };

    const logger = { info: jasmine.createSpy("info"), warn: jasmine.createSpy("warn") };

    const onProgress = jasmine.createSpy("onProgress");

    const service = new ProcessableTabsService({
      sheetsApiClient,
      headerValidator,
      rowParser,
      logger,
    });

    const { tabs } = await service.fetchAll("sheet-id", "api-key", onProgress);

    expect(tabs).toEqual([{ name: "Valid", entries: [{ ticker: "AAPL" }] }]);
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      'Skipped the "Invalid" tab: row 1 does not hold the required headers (ticker).',
    );
    expect(rowParser.parse).toHaveBeenCalledTimes(1);
    expect(onProgress).toHaveBeenCalledWith("Fetching sheet list...");
    expect(onProgress).toHaveBeenCalledWith('Fetching tab "Valid" (1/2)...');
  });

  it("throws when no processable tabs are found", async () => {
    const sheetsApiClient = {
      fetchSheetTabs: jasmine.createSpy("fetchSheetTabs").and.resolveTo(["A"]),
      fetchSheetValues: jasmine.createSpy("fetchSheetValues").and.resolveTo([["x"]]),
    };

    const headerValidator = {
      requiredFieldSlugs: ["ticker", "nombre"],
      hasProcessableHeaders: jasmine.createSpy("hasProcessableHeaders").and.returnValue(false),
    };

    const rowParser = { parse: jasmine.createSpy("parse") };

    const service = new ProcessableTabsService({
      sheetsApiClient,
      headerValidator,
      rowParser,
      logger: { info: () => {}, warn: () => {} },
    });

    await expectAsync(service.fetchAll("sheet-id", "api-key")).toBeRejectedWithError(
      "No processable sheets found. Required headers in row 1: ticker, nombre",
    );
  });
  it("parses the history tabs instead of treating them as portfolios", async () => {
    const rowsByTab = {
      Valid: [["Valid"], ["row"]],
      "Index hist": [["Ticker", "Fecha", "Valor"], ["INDEXSP:.INX", "2025-01-02", "5,868.55"]],
      "prices HIST": [["Fecha", "Día", "AAPL"], ["2025-01-02", "Thu", "243.85"]],
    };

    const sheetsApiClient = {
      fetchSheetTabs: jasmine.createSpy("fetchSheetTabs").and.resolveTo(["Valid", "Index hist", "prices HIST"]),
      fetchSheetValues: jasmine
        .createSpy("fetchSheetValues")
        .and.callFake(async (_spreadsheetId, tabName) => rowsByTab[tabName]),
    };

    const service = new ProcessableTabsService({
      sheetsApiClient,
      headerValidator: {
        requiredFieldSlugs: ["ticker"],
        hasProcessableHeaders: () => true,
      },
      rowParser: { parse: () => [{ ticker: "AAPL" }] },
      indexHistoryParser: new IndexHistoryParser(),
      priceHistoryParser: new PriceHistoryParser(),
      logger: { info: () => {}, warn: () => {} },
    });

    const { tabs, history } = await service.fetchAll("sheet-id", "api-key");

    expect(tabs.map((tab) => tab.name)).toEqual(["Valid"]);
    expect(history.indexSeries.sessions).toEqual([{ date: "2025-01-02", value: 5868.55 }]);
    expect(history.priceSeriesByTicker.get("AAPL").sessions).toEqual([{ date: "2025-01-02", value: 243.85 }]);
  });

  it("leaves the history empty when the spreadsheet has no history tabs", async () => {
    const service = new ProcessableTabsService({
      sheetsApiClient: {
        fetchSheetTabs: jasmine.createSpy("fetchSheetTabs").and.resolveTo(["Valid"]),
        fetchSheetValues: jasmine.createSpy("fetchSheetValues").and.resolveTo([["Valid"], ["row"]]),
      },
      headerValidator: { requiredFieldSlugs: ["ticker"], hasProcessableHeaders: () => true },
      rowParser: { parse: () => [{ ticker: "AAPL" }] },
      indexHistoryParser: new IndexHistoryParser(),
      priceHistoryParser: new PriceHistoryParser(),
      logger: { info: () => {}, warn: () => {} },
    });

    const { history } = await service.fetchAll("sheet-id", "api-key");

    expect(history.indexSeries).toBeNull();
    expect(history.priceSeriesByTicker.size).toBe(0);
  });

  it("collects the history tab warnings so the ui can show them", async () => {
    const rowsByTab = {
      Valid: [["Valid"], ["row"]],
      "Index hist": [["Fecha", "Valor"], ["3/1/2025", "5,868.55"]],
      "Prices hist": [["Fecha", "Día", "AAPL"], ["2025-01-02", "Thu", "n.d."]],
    };

    const service = new ProcessableTabsService({
      sheetsApiClient: {
        fetchSheetTabs: jasmine.createSpy("fetchSheetTabs").and.resolveTo(["Valid", "Index hist", "Prices hist"]),
        fetchSheetValues: jasmine
          .createSpy("fetchSheetValues")
          .and.callFake(async (_spreadsheetId, tabName) => rowsByTab[tabName]),
      },
      headerValidator: { requiredFieldSlugs: ["ticker"], hasProcessableHeaders: () => true },
      rowParser: { parse: () => [{ ticker: "AAPL" }] },
      indexHistoryParser: new IndexHistoryParser(),
      priceHistoryParser: new PriceHistoryParser(),
      logger: { info: () => {}, warn: () => {} },
    });

    const { history } = await service.fetchAll("sheet-id", "api-key");

    expect(history.hasIndexTab).toBeTrue();
    expect(history.hasPricesTab).toBeTrue();
    expect(history.issues).toEqual([
      '"Index hist": row 2 holds "3/1/2025" under "Fecha" instead of a YYYY-MM-DD date; the value is ignored.',
      '"Index hist": no readable session found under the "Fecha"/"Valor" columns.',
      '"Prices hist": row 2 holds "n.d." under AAPL instead of a price; the cell is ignored.',
      '"Prices hist": the AAPL column has no price at all.',
    ]);
  });

  it("warns about the history tabs the spreadsheet does not have", async () => {
    const warn = jasmine.createSpy("warn");
    const service = new ProcessableTabsService({
      sheetsApiClient: {
        fetchSheetTabs: jasmine.createSpy("fetchSheetTabs").and.resolveTo(["Valid"]),
        fetchSheetValues: jasmine.createSpy("fetchSheetValues").and.resolveTo([["Valid"], ["row"]]),
      },
      headerValidator: { requiredFieldSlugs: ["ticker"], hasProcessableHeaders: () => true },
      rowParser: { parse: () => [{ ticker: "AAPL" }] },
      indexHistoryParser: new IndexHistoryParser(),
      priceHistoryParser: new PriceHistoryParser(),
      logger: { info: () => {}, warn },
    });

    const { history } = await service.fetchAll("sheet-id", "api-key");

    const expected =
      'No "Index hist" or "Prices hist" tab found, so "Block sales S&P 500 -D" cannot hold back any sale; '
      + "clear that field if you do not use it.";
    expect(history.hasIndexTab).toBeFalse();
    expect(history.hasPricesTab).toBeFalse();
    expect(history.issues).toEqual([expected]);
    expect(warn).toHaveBeenCalledWith(expected);
  });
});
