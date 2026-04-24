import { AppController } from "../../src/AppController.js";

describe("AppController", () => {
    it("registers the calculate callback on start", () => {
        const form = {
            onCalculate: jasmine.createSpy("onCalculate"),
        };

        const controller = new AppController({
            form,
            statusView: {},
            resultsContainer: {},
            spreadsheetIdExtractor: {},
            bulkFormInputParser: {},
            googleSheetsService: {},
            portfolioCalculator: {},
            resultsTableRenderer: {},
        });

        controller.start();

        expect(form.onCalculate).toHaveBeenCalled();
        expect(typeof form.onCalculate.calls.mostRecent().args[0]).toBe("function");
    });

    it("shows an error when the spreadsheet url is missing", async () => {
        const { controller, statusView } = createController({
            getValues: jasmine.createSpy("getValues").and.returnValue({
                spreadsheetUrl: "",
                apiKey: "key",
                firstNRaw: "4",
                bulkInputText: "",
            }),
        });

        await startAndRun(controller);

        expect(statusView.show).toHaveBeenCalledWith("Please enter a Google Sheets URL.", "error");
    });

    it("applies bulk values before validating the inputs", async () => {
        const form = {
            onCalculate: jasmine.createSpy("onCalculate"),
            getValues: jasmine.createSpy("getValues").and.returnValues(
                { spreadsheetUrl: "", apiKey: "", firstNRaw: "", bulkInputText: " bulk " },
                { spreadsheetUrl: "https://docs.google.com/spreadsheets/d/abc", apiKey: "key", firstNRaw: "4", bulkInputText: " bulk " }
            ),
            applyBulkValues: jasmine.createSpy("applyBulkValues"),
            parseFirstNValues: jasmine.createSpy("parseFirstNValues").and.returnValue([4]),
            setCalculating: jasmine.createSpy("setCalculating"),
        };
        const bulkFormInputParser = {
            parse: jasmine.createSpy("parse").and.returnValue({
                spreadsheetUrl: "https://docs.google.com/spreadsheets/d/abc",
                apiKey: "key",
                firstN: "4",
            }),
        };
        const spreadsheetIdExtractor = {
            extract: jasmine.createSpy("extract").and.returnValue("sheet-id"),
        };
        const googleSheetsService = {
            fetchConfiguredTabs: jasmine.createSpy("fetchConfiguredTabs").and.resolveTo([[]]),
        };
        const portfolioCalculator = {
            calculate: jasmine.createSpy("calculate").and.returnValue([{ topN: 4 }]),
        };
        const resultsTableRenderer = {
            render: jasmine.createSpy("render"),
        };
        const statusView = {
            show: jasmine.createSpy("show"),
            clear: jasmine.createSpy("clear"),
        };
        const resultsContainer = document.createElement("div");

        const controller = new AppController({
            form,
            statusView,
            resultsContainer,
            spreadsheetIdExtractor,
            bulkFormInputParser,
            googleSheetsService,
            portfolioCalculator,
            resultsTableRenderer,
        });

        await startAndRun(controller);

        expect(bulkFormInputParser.parse).toHaveBeenCalledWith(" bulk ");
        expect(form.applyBulkValues).toHaveBeenCalledWith({
            spreadsheetUrl: "https://docs.google.com/spreadsheets/d/abc",
            apiKey: "key",
            firstN: "4",
        });
        expect(googleSheetsService.fetchConfiguredTabs).toHaveBeenCalledWith("sheet-id", "key");
        expect(portfolioCalculator.calculate).toHaveBeenCalledWith([[]], [4]);
        expect(resultsTableRenderer.render).toHaveBeenCalledWith([{ topN: 4 }], resultsContainer);
        expect(statusView.clear).toHaveBeenCalled();
    });

    it("shows an error when the api key is missing", async () => {
        const { controller, statusView } = createController({
            getValues: jasmine.createSpy("getValues").and.returnValue({
                spreadsheetUrl: "https://docs.google.com/spreadsheets/d/abc",
                apiKey: "",
                firstNRaw: "4",
                bulkInputText: "",
            }),
        });

        await startAndRun(controller);

        expect(statusView.show).toHaveBeenCalledWith("Please enter a Google API Key.", "error");
    });

    it("shows an error when the spreadsheet id cannot be extracted", async () => {
        const { controller, statusView, spreadsheetIdExtractor } = createController();
        spreadsheetIdExtractor.extract.and.throwError("Could not extract spreadsheet ID from URL.");

        await startAndRun(controller);

        expect(statusView.show).toHaveBeenCalledWith("Could not extract spreadsheet ID from URL.", "error");
    });

    it("shows an error when there are no valid first-n values", async () => {
        const { controller, statusView, form } = createController();
        form.parseFirstNValues.and.returnValue([]);

        await startAndRun(controller);

        expect(statusView.show).toHaveBeenCalledWith("Please enter at least one valid 'First N' value.", "error");
    });

    it("renders results when the full flow succeeds", async () => {
        const { controller, statusView, form, googleSheetsService, portfolioCalculator, resultsTableRenderer, resultsContainer } = createController();

        googleSheetsService.fetchConfiguredTabs.and.resolveTo([[{ ticker: "AAA" }]]);
        portfolioCalculator.calculate.and.returnValue([{ topN: 4 }]);

        await startAndRun(controller);

        expect(form.setCalculating.calls.argsFor(0)).toEqual([true]);
        expect(form.setCalculating.calls.mostRecent().args).toEqual([false]);
        expect(statusView.show.calls.argsFor(0)).toEqual(["Fetching data from Google Sheets...", "info"]);
        expect(statusView.show.calls.argsFor(1)).toEqual(["Calculating...", "info"]);
        expect(statusView.clear).toHaveBeenCalled();
        expect(resultsTableRenderer.render).toHaveBeenCalledWith([{ topN: 4 }], resultsContainer);
    });

    it("shows an error and re-enables the button when the service fails", async () => {
        const { controller, statusView, form, googleSheetsService } = createController();
        spyOn(console, "error");
        googleSheetsService.fetchConfiguredTabs.and.rejectWith(new Error("Boom"));

        await startAndRun(controller);

        expect(statusView.show).toHaveBeenCalledWith("Error: Boom", "error");
        expect(form.setCalculating.calls.mostRecent().args).toEqual([false]);
        expect(console.error).toHaveBeenCalled();
    });
});

function createController(overrides = {}) {
    const form = {
        onCalculate: jasmine.createSpy("onCalculate"),
        getValues: jasmine.createSpy("getValues").and.returnValue({
            spreadsheetUrl: "https://docs.google.com/spreadsheets/d/abc",
            apiKey: "key",
            firstNRaw: "4",
            bulkInputText: "",
        }),
        applyBulkValues: jasmine.createSpy("applyBulkValues"),
        parseFirstNValues: jasmine.createSpy("parseFirstNValues").and.returnValue([4]),
        setCalculating: jasmine.createSpy("setCalculating"),
        ...overrides,
    };
    const statusView = {
        show: jasmine.createSpy("show"),
        clear: jasmine.createSpy("clear"),
    };
    const resultsContainer = document.createElement("div");
    const spreadsheetIdExtractor = {
        extract: jasmine.createSpy("extract").and.returnValue("sheet-id"),
    };
    const bulkFormInputParser = {
        parse: jasmine.createSpy("parse"),
    };
    const googleSheetsService = {
        fetchConfiguredTabs: jasmine.createSpy("fetchConfiguredTabs").and.resolveTo([[]]),
    };
    const portfolioCalculator = {
        calculate: jasmine.createSpy("calculate").and.returnValue([]),
    };
    const resultsTableRenderer = {
        render: jasmine.createSpy("render"),
    };

    return {
        controller: new AppController({
            form,
            statusView,
            resultsContainer,
            spreadsheetIdExtractor,
            bulkFormInputParser,
            googleSheetsService,
            portfolioCalculator,
            resultsTableRenderer,
        }),
        form,
        statusView,
        resultsContainer,
        spreadsheetIdExtractor,
        bulkFormInputParser,
        googleSheetsService,
        portfolioCalculator,
        resultsTableRenderer,
    };
}

async function startAndRun(controller) {
    controller.start();
    const callback = controller.form.onCalculate.calls.mostRecent().args[0];
    await callback();
}
