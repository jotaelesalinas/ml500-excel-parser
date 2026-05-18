export class CalculationController {
  constructor({
    spreadsheetIdExtractor,
    processableTabsService,
    portfolioResultsCalculator,
    statusView,
    resultsTableView,
    buttonElement,
    spreadsheetUrlElement,
    apiKeyElement,
    firstNElement,
    logger = console,
  }) {
    this.spreadsheetIdExtractor = spreadsheetIdExtractor;
    this.processableTabsService = processableTabsService;
    this.portfolioResultsCalculator = portfolioResultsCalculator;
    this.statusView = statusView;
    this.resultsTableView = resultsTableView;
    this.buttonElement = buttonElement;
    this.spreadsheetUrlElement = spreadsheetUrlElement;
    this.apiKeyElement = apiKeyElement;
    this.firstNElement = firstNElement;
    this.logger = logger;
  }

  bind() {
    this.buttonElement.addEventListener("click", () => {
      this.handleCalculate();
    });
  }

  async handleCalculate() {
    const urlInput = this.spreadsheetUrlElement.value.trim();
    const apiKey = this.apiKeyElement.value.trim();
    const firstNRaw = this.firstNElement.value.trim();

    if (!urlInput) {
      this.statusView.show("Please enter a Google Sheets URL.", "error");
      return;
    }

    if (!apiKey) {
      this.statusView.show("Please enter a Google API Key.", "error");
      return;
    }

    let spreadsheetId;
    try {
      spreadsheetId = this.spreadsheetIdExtractor.extract(urlInput);
    } catch (error) {
      this.statusView.show(error.message, "error");
      return;
    }

    const firstNValues = this.parseFirstNValues(firstNRaw);
    if (firstNValues.length === 0) {
      this.statusView.show("Please enter at least one valid 'First N' value.", "error");
      return;
    }

    this.buttonElement.disabled = true;
    this.statusView.show("Fetching data from Google Sheets...", "info");

    try {
      const tabs = await this.processableTabsService.fetchAll(spreadsheetId, apiKey);
      this.statusView.show("Calculating...", "info");
      const results = this.portfolioResultsCalculator.calculate(tabs, firstNValues);
      this.statusView.clear();
      this.resultsTableView.render(results);
    } catch (error) {
      this.statusView.show(`Error: ${error.message}`, "error");
      this.logger.error(error);
    } finally {
      this.buttonElement.disabled = false;
    }
  }

  parseFirstNValues(raw) {
    return raw
      .split(/\s*,\s*/g)
      .map(Number)
      .filter((value) => value > 0);
  }
}
