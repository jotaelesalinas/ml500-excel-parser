export class CalculationController {
  constructor({
    spreadsheetIdExtractor,
    processableTabsService,
    portfolioResultsCalculator,
    statusView,
    resultsTableView,
    loadButtonElement,
    calculateButtonElement,
    spreadsheetUrlElement,
    apiKeyElement,
    firstNElement,
    bulkInputElement,
    bulkFormInputParser,
    logger = console,
  }) {
    this.spreadsheetIdExtractor = spreadsheetIdExtractor;
    this.processableTabsService = processableTabsService;
    this.portfolioResultsCalculator = portfolioResultsCalculator;
    this.statusView = statusView;
    this.resultsTableView = resultsTableView;
    this.loadButtonElement = loadButtonElement;
    this.calculateButtonElement = calculateButtonElement;
    this.spreadsheetUrlElement = spreadsheetUrlElement;
    this.apiKeyElement = apiKeyElement;
    this.firstNElement = firstNElement;
    this.bulkInputElement = bulkInputElement;
    this.bulkFormInputParser = bulkFormInputParser;
    this.logger = logger;

    this.loadedTabs = null;
    this.loadedCacheKey = null;
    this.pendingLoadPromise = null;

    this.loadButtonLabelDefault = "Load data";
    this.loadButtonLabelLoaded = "Reload";
    this.loadButtonLabelLoading = "Loading data...";
    this.resetLoadButtonLabel();
  }

  bind() {
    this.loadButtonElement.addEventListener("click", () => {
      this.handleLoadButton();
    });

    this.calculateButtonElement.addEventListener("click", () => {
      this.handleCalculate();
    });
  }

  async handleLoadButton() {
    await this.loadData({ forceReload: true });
  }

  async handleCalculate() {
    this.applyBulkInput();

    const firstNRaw = this.firstNElement.value.trim();
    const firstNValues = this.parseFirstNValues(firstNRaw);
    if (firstNValues.length === 0) {
      this.statusView.show("Please enter at least one valid 'First N' value.", "error");
      return;
    }

    const tabs = await this.ensureDataLoaded();
    if (!tabs) {
      return;
    }

    try {
      this.statusView.show(`Calculating results for ${tabs.length} tab(s)...`, "info");
      const results = this.portfolioResultsCalculator.calculate(tabs, firstNValues);
      this.statusView.clear();
      this.resultsTableView.render(results);
    } catch (error) {
      this.statusView.show(`Error: ${error.message}`, "error");
      this.logger.error(error);
    }
  }

  async ensureDataLoaded() {
    const context = this.buildLoadContext();
    if (!context) {
      return null;
    }

    if (this.loadedTabs && this.loadedCacheKey === context.cacheKey) {
      return this.loadedTabs;
    }

    return this.loadData({ forceReload: false, context });
  }

  async loadData({ forceReload, context = null }) {
    const resolvedContext = context || this.buildLoadContext();
    if (!resolvedContext) {
      return null;
    }

    if (!forceReload && this.pendingLoadPromise) {
      return this.pendingLoadPromise;
    }

    if (!forceReload && this.loadedTabs && this.loadedCacheKey === resolvedContext.cacheKey) {
      return this.loadedTabs;
    }

    this.loadButtonElement.disabled = true;
    this.loadButtonElement.textContent = this.loadButtonLabelLoading;
    this.statusView.show("Loading data from Google Sheets...", "info");

    const loadPromise = this.processableTabsService
      .fetchAll(
        resolvedContext.spreadsheetId,
        resolvedContext.apiKey,
        (msg) => this.statusView.show(msg, "info"),
      )
      .then((tabs) => {
        this.loadedTabs = tabs;
        this.loadedCacheKey = resolvedContext.cacheKey;
        this.loadButtonElement.textContent = this.loadButtonLabelLoaded;
        this.statusView.show(`Loaded ${tabs.length} tab(s).`, "info");
        return tabs;
      })
      .catch((error) => {
        this.statusView.show(`Error: ${error.message}`, "error");
        this.logger.error(error);
        this.loadedTabs = null;
        this.loadedCacheKey = null;
        this.resetLoadButtonLabel();
        return null;
      })
      .finally(() => {
        this.loadButtonElement.disabled = false;
        if (this.pendingLoadPromise === loadPromise) {
          this.pendingLoadPromise = null;
        }
      });

    this.pendingLoadPromise = loadPromise;
    return loadPromise;
  }

  buildLoadContext() {
    this.applyBulkInput();

    const urlInput = this.spreadsheetUrlElement.value.trim();
    const apiKey = this.apiKeyElement.value.trim();

    if (!urlInput) {
      this.statusView.show("Please enter a Google Sheets URL.", "error");
      this.loadedTabs = null;
      this.loadedCacheKey = null;
      this.resetLoadButtonLabel();
      return null;
    }

    if (!apiKey) {
      this.statusView.show("Please enter a Google API Key.", "error");
      this.loadedTabs = null;
      this.loadedCacheKey = null;
      this.resetLoadButtonLabel();
      return null;
    }

    let spreadsheetId;
    try {
      spreadsheetId = this.spreadsheetIdExtractor.extract(urlInput);
    } catch (error) {
      this.statusView.show(error.message, "error");
      this.loadedTabs = null;
      this.loadedCacheKey = null;
      this.resetLoadButtonLabel();
      return null;
    }

    const cacheKey = `${spreadsheetId}::${apiKey}`;
    return { spreadsheetId, apiKey, cacheKey };
  }

  parseFirstNValues(raw) {
    return raw
      .split(/\s*,\s*/g)
      .map(Number)
      .filter((value) => value > 0);
  }

  applyBulkInput() {
    const bulkInput = this.bulkInputElement?.value || "";
    if (!bulkInput.trim() || !this.bulkFormInputParser) {
      return;
    }

    const parsed = this.bulkFormInputParser.parse(bulkInput);
    if (parsed.spreadsheetUrl) {
      this.spreadsheetUrlElement.value = parsed.spreadsheetUrl;
    }
    if (parsed.apiKey) {
      this.apiKeyElement.value = parsed.apiKey;
    }
    if (parsed.firstN) {
      this.firstNElement.value = parsed.firstN;
    }
  }

  resetLoadButtonLabel() {
    this.loadButtonElement.textContent = this.loadButtonLabelDefault;
  }
}

