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

    const logger = { info: jasmine.createSpy("info") };

    const onProgress = jasmine.createSpy("onProgress");

    const service = new ProcessableTabsService({
      sheetsApiClient,
      headerValidator,
      rowParser,
      logger,
    });

    const { tabs } = await service.fetchAll("sheet-id", "api-key", onProgress);

    expect(tabs).toEqual([{ name: "Valid", entries: [{ ticker: "AAPL" }] }]);
    expect(logger.info).toHaveBeenCalledTimes(1);
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
      logger: { info: () => {} },
    });

    await expectAsync(service.fetchAll("sheet-id", "api-key")).toBeRejectedWithError(
      "No processable sheets found. Required headers in row 1: ticker, nombre",
    );
  });
  it("parses the history tabs instead of treating them as portfolios", async () => {
    const rowsByTab = {
      Valid: [["Valid"], ["row"]],
      "Index hist": [["Ticker", "Fecha", "Valor"], ["INDEXSP:.INX", "2025-01-02", "5,868.55"]],
      "prices HIST": [["AAPL", ""], ["2025-01-02", "243.85"]],
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
      logger: { info: () => {} },
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
      logger: { info: () => {} },
    });

    const { history } = await service.fetchAll("sheet-id", "api-key");

    expect(history.indexSeries).toBeNull();
    expect(history.priceSeriesByTicker.size).toBe(0);
  });
});
