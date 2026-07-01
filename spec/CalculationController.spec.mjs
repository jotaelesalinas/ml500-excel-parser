import { CalculationController } from "../src/app/CalculationController.js";

describe("CalculationController", () => {
  function createController(overrides = {}) {
    const loadButtonElement = {
      addEventListener: jasmine.createSpy("loadButtonAddEventListener"),
    };
    const calculateButtonElement = {
      addEventListener: jasmine.createSpy("calculateButtonAddEventListener"),
    };

    const uiState = {
      setProcessing: jasmine.createSpy("setProcessing"),
      setLoadButtonLabel: jasmine.createSpy("setLoadButtonLabel"),
      clearResultsSelection: jasmine.createSpy("clearResultsSelection"),
      setResults: jasmine.createSpy("setResults"),
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
      uiState,
      loadButtonElement,
      calculateButtonElement,
      spreadsheetUrlElement: { value: "https://docs.google.com/spreadsheets/d/abc/edit" },
      apiKeyElement: { value: "api-key" },
      firstNElement: { value: "4, 10" },
      minDepositElement: { value: "1000" },
      minInvestmentElement: { value: "100" },
      smoothNElement: { value: "4" },
      bulkInputElement: { value: "" },
      bulkFormInputParser: {
        parse: jasmine.createSpy("parse").and.returnValue({
          spreadsheetUrl: "",
          apiKey: "",
          firstN: "",
          minDeposit: "",
          minInvestment: "",
          reinvest: null,
          incremental: null,
        }),
      },
      logger: { error: jasmine.createSpy("error") },
      ...overrides,
    };

    return { controller: new CalculationController(deps), deps, uiState };
  }

  it("binds click events", () => {
    const { controller, deps } = createController();

    controller.bind();

    expect(deps.loadButtonElement.addEventListener).toHaveBeenCalledWith("click", jasmine.any(Function));
    expect(deps.calculateButtonElement.addEventListener).toHaveBeenCalledWith("click", jasmine.any(Function));
  });

  it("parses First N values", () => {
    const { controller } = createController();

    expect(controller.parseFirstNValues("4, x, 10, -1, 0")).toEqual([4, 10]);
  });

  it("shows validation error for missing URL on load", async () => {
    const { controller, deps, uiState } = createController({ spreadsheetUrlElement: { value: "" } });

    await controller.handleLoadButton();

    expect(deps.statusView.show).toHaveBeenCalledWith("Please enter a Google Sheets URL.", "error");
    expect(deps.processableTabsService.fetchAll).not.toHaveBeenCalled();
    expect(uiState.setLoadButtonLabel).toHaveBeenCalledWith("Load data");
    expect(uiState.setProcessing).not.toHaveBeenCalled();
  });

  it("loads data successfully and writes processing and label state to the store", async () => {
    const { controller, deps, uiState } = createController();

    await controller.handleLoadButton();

    expect(deps.processableTabsService.fetchAll).toHaveBeenCalledWith("sheet-id", "api-key", jasmine.any(Function));
    expect(uiState.setProcessing).toHaveBeenCalledWith(true);
    expect(uiState.setLoadButtonLabel).toHaveBeenCalledWith("Loading data...");
    expect(uiState.setLoadButtonLabel).toHaveBeenCalledWith("Reload");
    expect(uiState.setProcessing).toHaveBeenCalledWith(false);
  });

  it("runs successful calculation flow with auto-load through the store", async () => {
    const { controller, deps, uiState } = createController();

    await controller.handleCalculate();

    expect(deps.processableTabsService.fetchAll).toHaveBeenCalledWith("sheet-id", "api-key", jasmine.any(Function));
    expect(deps.portfolioResultsCalculator.calculate).toHaveBeenCalledWith(
      [{ name: "Tab", entries: [] }],
      [4, 10],
      { minDeposit: 1000, minInvestment: 100, smoothN: 4 },
    );
    expect(deps.statusView.clear).toHaveBeenCalled();
    expect(uiState.clearResultsSelection).toHaveBeenCalled();
    expect(uiState.setResults).toHaveBeenCalledWith([{ tab: "Tab" }]);
    expect(uiState.setProcessing).toHaveBeenCalledWith(true);
    expect(uiState.setProcessing).toHaveBeenCalledWith(false);
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
          minDeposit: "1500",
          minInvestment: "250",
          reinvest: true,
          incremental: true,
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
      { minDeposit: 1500, minInvestment: 250, smoothN: 4 },
    );
  });

  it("resets the load label when loading fails", async () => {
    const error = new Error("service down");
    const { controller, deps, uiState } = createController({
      processableTabsService: {
        fetchAll: jasmine.createSpy("fetchAll").and.rejectWith(error),
      },
    });

    await controller.handleLoadButton();

    expect(deps.statusView.show).toHaveBeenCalledWith("Error: service down", "error");
    expect(deps.logger.error).toHaveBeenCalledWith(error);
    expect(uiState.setLoadButtonLabel).toHaveBeenCalledWith("Load data");
    expect(uiState.setProcessing).toHaveBeenCalledWith(true);
    expect(uiState.setProcessing).toHaveBeenCalledWith(false);
  });
});
