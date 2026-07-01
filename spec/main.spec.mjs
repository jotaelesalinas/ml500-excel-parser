import { bootstrap } from "../src/main.js";

describe("bootstrap", () => {
  it("wires the ui state into the controller, page controls and buttons", () => {
    const loadButton = { textContent: "", disabled: false, addEventListener: jasmine.createSpy("loadAddEventListener") };
    const calculateButton = { disabled: false, addEventListener: jasmine.createSpy("calculateAddEventListener") };
    const documentStub = {
      getElementById: jasmine.createSpy("getElementById").and.callFake((id) => {
        const elements = {
          status: {},
          results: {},
          "btn-load-data": loadButton,
          "btn-calculate": calculateButton,
          "spreadsheet-url": {},
          "api-key": {},
          "first-n": {},
          "min-deposit": {},
          "min-investment": {},
          "smooth-n": {},
          "bulk-input": {},
        };
        return elements[id] || null;
      }),
      querySelectorAll: jasmine.createSpy("querySelectorAll").and.returnValue([{ value: "Fixed D" }]),
    };

    const uiState = {
      state: {
        loadButtonLabel: "Load data",
        isProcessing: false,
        inputMode: "fields",
        visibleStrategies: null,
        results: [],
        sortState: { field: null, direction: "asc", hasSorted: false },
        selectedResultKey: null,
      },
      listeners: [],
      subscribe: jasmine.createSpy("subscribe").and.callFake((listener) => {
        uiState.listeners.push(listener);
        return () => {};
      }),
      getState: jasmine.createSpy("getState").and.callFake(() => uiState.state),
      setLoadButtonLabel: jasmine.createSpy("setLoadButtonLabel"),
      setProcessing: jasmine.createSpy("setProcessing"),
    };

    const controllerBind = jasmine.createSpy("bind");
    const pageControlsBind = jasmine.createSpy("pageControlsBind");
    const resultsViewCtor = jasmine.createSpy("resultsViewCtor");
    const pageControlsCtor = jasmine.createSpy("pageControlsCtor").and.callFake(function (...args) {
      pageControlsCtor.args = args;
      this.bind = pageControlsBind;
    });
    const calculationControllerCtor = jasmine.createSpy("calculationControllerCtor").and.callFake(function (deps) {
      calculationControllerCtor.deps = deps;
      this.bind = controllerBind;
    });
    const statusViewCtor = jasmine.createSpy("statusViewCtor").and.callFake(function () {});

    bootstrap(documentStub, {
      uiState,
      ResultsTableView: class {
        constructor(container, passedUiState) {
          resultsViewCtor(container, passedUiState);
        }
      },
      PageControlsController: pageControlsCtor,
      CalculationController: calculationControllerCtor,
      StatusView: statusViewCtor,
      SpreadsheetIdExtractor: class {},
      GoogleSheetsApiClient: class {},
      SheetRowParser: class { constructor() {} },
      SheetHeaderValidator: class { constructor() {} },
      ProcessableTabsService: class { constructor() {} },
      FirstNFilter: class {},
      PortfolioMovementMapper: class {},
      XirrCalculator: class {},
      WeightedAgeCalculator: class {},
      PortfolioResultsCalculator: class { constructor() {} },
      BulkFormInputParser: class {},
      createUiState: () => uiState,
    });

    expect(resultsViewCtor).toHaveBeenCalledWith(documentStub.getElementById("results"), uiState);
    expect(pageControlsBind).toHaveBeenCalled();
    expect(controllerBind).toHaveBeenCalled();
    expect(calculationControllerCtor.deps.uiState).toBe(uiState);

    uiState.listeners[0]({
      loadButtonLabel: "Reload",
      isProcessing: true,
    }, {
      loadButtonLabel: "Load data",
      isProcessing: false,
    });

    expect(loadButton.textContent).toBe("Reload");
    expect(loadButton.disabled).toBeTrue();
    expect(calculateButton.disabled).toBeTrue();
  });
});
