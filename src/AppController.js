export class AppController {
    constructor({ form, statusView, resultsContainer, spreadsheetIdExtractor, bulkFormInputParser, googleSheetsService, portfolioCalculator, resultsTableRenderer }) {
        this.form = form;
        this.statusView = statusView;
        this.resultsContainer = resultsContainer;
        this.spreadsheetIdExtractor = spreadsheetIdExtractor;
        this.bulkFormInputParser = bulkFormInputParser;
        this.googleSheetsService = googleSheetsService;
        this.portfolioCalculator = portfolioCalculator;
        this.resultsTableRenderer = resultsTableRenderer;
    }

    start() {
        this.form.onCalculate(() => this.#handleCalculate());
    }

    async #handleCalculate() {
        const inputValues = this.form.getValues();

        if (inputValues.bulkInputText.trim()) {
            this.form.applyBulkValues(this.bulkFormInputParser.parse(inputValues.bulkInputText));
        }

        const currentValues = this.form.getValues();
        if (!currentValues.spreadsheetUrl) {
            this.statusView.show("Please enter a Google Sheets URL.", "error");
            return;
        }
        if (!currentValues.apiKey) {
            this.statusView.show("Please enter a Google API Key.", "error");
            return;
        }

        let spreadsheetId;
        try {
            spreadsheetId = this.spreadsheetIdExtractor.extract(currentValues.spreadsheetUrl);
        } catch (error) {
            this.statusView.show(error.message, "error");
            return;
        }

        const firstNValues = this.form.parseFirstNValues();
        if (firstNValues.length === 0) {
            this.statusView.show("Please enter at least one valid 'First N' value.", "error");
            return;
        }

        this.form.setCalculating(true);
        this.statusView.show("Fetching data from Google Sheets...", "info");

        try {
            const tabs = await this.googleSheetsService.fetchConfiguredTabs(spreadsheetId, currentValues.apiKey);
            this.statusView.show("Calculating...", "info");
            const results = this.portfolioCalculator.calculate(tabs, firstNValues);
            this.statusView.clear();
            this.resultsTableRenderer.render(results, this.resultsContainer);
        } catch (error) {
            this.statusView.show(`Error: ${error.message}`, "error");
            console.error(error);
        } finally {
            this.form.setCalculating(false);
        }
    }
}
