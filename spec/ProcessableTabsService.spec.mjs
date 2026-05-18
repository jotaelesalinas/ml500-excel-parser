import { ProcessableTabsService } from "../src/services/ProcessableTabsService.js";

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

    const service = new ProcessableTabsService({
      sheetsApiClient,
      headerValidator,
      rowParser,
      logger,
    });

    const tabs = await service.fetchAll("sheet-id", "api-key");

    expect(tabs).toEqual([{ name: "Valid", entries: [{ ticker: "AAPL" }] }]);
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(rowParser.parse).toHaveBeenCalledTimes(1);
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
});
