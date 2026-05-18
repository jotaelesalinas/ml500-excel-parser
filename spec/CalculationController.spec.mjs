import { CalculationController } from "../src/app/CalculationController.js";

describe("CalculationController", () => {
  function createController(overrides = {}) {
    const loadButtonElement = {
      disabled: false,
      textContent: "",
      addEventListener: jasmine.createSpy("addEventListener"),
    };
    const calculateButtonElement = {
      disabled: false,
      addEventListener: jasmine.createSpy("addEventListener"),
    };

    const deps = {
      spreadsheetIdExtractor: {
        extract: jasmine.createSpy("extract").and.returnValue("sheet-id"),
      },
      processableTabsService: {
        fetchAll: jasmine.createSpy("fetchAll").and.resolveTo([{ name: "Tab", entries: [] }]),
      },
      portfolioResultsCalculator: {
        calculate: jasmine.createSpy("calculate").and.returnValue([{ tab: "Tab" }]),
      },
      statusView: {
        show: jasmine.createSpy("show"),
        clear: jasmine.createSpy("clear"),
      },
      resultsTableView: {
        render: jasmine.createSpy("render"),
      },
      loadButtonElement,
      calculateButtonElement,
      spreadsheetUrlElement: { value: "https://docs.google.com/spreadsheets/d/abc/edit" },
      apiKeyElement: { value: "api-key" },
      firstNElement: { value: "4, 10" },
      bulkInputElement: { value: "" },
      bulkFormInputParser: {
        parse: jasmine.createSpy("parse").and.returnValue({
          spreadsheetUrl: "",
          apiKey: "",
          firstN: "",
        }),
      },
      logger: { error: jasmine.createSpy("error") },
      ...overrides,
    };

    return { controller: new CalculationController(deps), deps };
  }

  it("binds click events", () => {
    const { controller, deps } = createController();

    controller.bind();

    expect(deps.loadButtonElement.addEventListener).toHaveBeenCalledWith("click", jasmine.any(Function));
    expect(deps.calculateButtonElement.addEventListener).toHaveBeenCalledWith("click", jasmine.any(Function));
  });

  it("starts with load button label", () => {
    const { deps } = createController();

    expect(deps.loadButtonElement.textContent).toBe("Load data");
  });

  it("parses First N values", () => {
    const { controller } = createController();

    expect(controller.parseFirstNValues("4, x, 10, -1, 0")).toEqual([4, 10]);
  });

  it("shows validation error for missing URL on load", async () => {
    const { controller, deps } = createController({ spreadsheetUrlElement: { value: "" } });

    await controller.handleLoadButton();

    expect(deps.statusView.show).toHaveBeenCalledWith("Please enter a Google Sheets URL.", "error");
    expect(deps.processableTabsService.fetchAll).not.toHaveBeenCalled();
    expect(deps.loadButtonElement.textContent).toBe("Load data");
  });

  it("loads data successfully and sets Reload label", async () => {
    const { controller, deps } = createController();

    await controller.handleLoadButton();

    expect(deps.processableTabsService.fetchAll).toHaveBeenCalledWith("sheet-id", "api-key", jasmine.any(Function));
    expect(deps.loadButtonElement.textContent).toBe("Reload");
    expect(deps.loadButtonElement.disabled).toBeFalse();
  });

  it("runs successful calculation flow with auto-load", async () => {
    const { controller, deps } = createController();

    await controller.handleCalculate();

    expect(deps.processableTabsService.fetchAll).toHaveBeenCalledWith("sheet-id", "api-key", jasmine.any(Function));
    expect(deps.portfolioResultsCalculator.calculate).toHaveBeenCalledWith(
      [{ name: "Tab", entries: [] }],
      [4, 10],
    );
    expect(deps.statusView.clear).toHaveBeenCalled();
    expect(deps.resultsTableView.render).toHaveBeenCalledWith([{ tab: "Tab" }]);
    expect(deps.calculateButtonElement.disabled).toBeFalse();
  });

  it("does not reload if cached data is still valid", async () => {
    const { controller, deps } = createController();

    await controller.handleCalculate();
    await controller.handleCalculate();

    expect(deps.processableTabsService.fetchAll).toHaveBeenCalledTimes(1);
    expect(deps.portfolioResultsCalculator.calculate).toHaveBeenCalledTimes(2);
  });

  it("applies bulk input before load and calculation", async () => {
    const { controller, deps } = createController({
      spreadsheetUrlElement: { value: "" },
      apiKeyElement: { value: "" },
      firstNElement: { value: "" },
      bulkInputElement: { value: "url\napi-key\n3, 8" },
      bulkFormInputParser: {
        parse: jasmine.createSpy("parse").and.returnValue({
          spreadsheetUrl: "https://docs.google.com/spreadsheets/d/from-bulk/edit",
          apiKey: "api-key-from-bulk",
          firstN: "3, 8",
        }),
      },
    });

    await controller.handleCalculate();

    expect(deps.bulkFormInputParser.parse).toHaveBeenCalledWith("url\napi-key\n3, 8");
    expect(deps.spreadsheetIdExtractor.extract).toHaveBeenCalledWith(
      "https://docs.google.com/spreadsheets/d/from-bulk/edit",
    );
    expect(deps.processableTabsService.fetchAll).toHaveBeenCalledWith(
      "sheet-id",
      "api-key-from-bulk",
      jasmine.any(Function),
    );
    expect(deps.portfolioResultsCalculator.calculate).toHaveBeenCalledWith(
      [{ name: "Tab", entries: [] }],
      [3, 8],
    );
  });

  it("resets button to Load data when loading fails", async () => {
    const error = new Error("service down");
    const { controller, deps } = createController({
      processableTabsService: {
        fetchAll: jasmine.createSpy("fetchAll").and.rejectWith(error),
      },
    });

    await controller.handleLoadButton();

    expect(deps.statusView.show).toHaveBeenCalledWith("Error: service down", "error");
    expect(deps.logger.error).toHaveBeenCalledWith(error);
    expect(deps.loadButtonElement.textContent).toBe("Load data");
    expect(deps.loadButtonElement.disabled).toBeFalse();
  });
});
