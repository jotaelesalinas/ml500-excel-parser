export class CalculationController {
  constructor({
    spreadsheetIdExtractor,
    processableTabsService,
    portfolioResultsCalculator,
    statusView,
    uiState,
    loadButtonElement,
    calculateButtonElement,
    spreadsheetUrlElement,
    apiKeyElement,
    firstNElement,
    minDepositElement,
    minInvestmentElement,
    smoothNElement,
    saleBlockElement,
    bulkInputElement,
    bulkFormInputParser,
    saleBlockLookbackParser,
    logger = console,
  }) {
    this.spreadsheetIdExtractor = spreadsheetIdExtractor;
    this.processableTabsService = processableTabsService;
    this.portfolioResultsCalculator = portfolioResultsCalculator;
    this.statusView = statusView;
    this.uiState = uiState;
    this.loadButtonElement = loadButtonElement;
    this.calculateButtonElement = calculateButtonElement;
    this.spreadsheetUrlElement = spreadsheetUrlElement;
    this.apiKeyElement = apiKeyElement;
    this.firstNElement = firstNElement;
    this.minDepositElement = minDepositElement;
    this.minInvestmentElement = minInvestmentElement;
    this.smoothNElement = smoothNElement;
    this.saleBlockElement = saleBlockElement;
    this.bulkInputElement = bulkInputElement;
    this.bulkFormInputParser = bulkFormInputParser;
    this.saleBlockLookbackParser = saleBlockLookbackParser;
    this.logger = logger;

    this.loadedData = null;
    this.loadedCacheKey = null;
    this.pendingLoadPromise = null;
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

    const strategy = this.parseStrategyInputs();
    if (!strategy) {
      return;
    }

    try {
      const loadedData = await this.ensureDataLoaded();
      if (!loadedData) {
        return;
      }
      const { tabs, history } = loadedData;
      this.uiState.setProcessing(true);
      this.statusView.show(`Calculating results for ${tabs.length} tab(s)...`, "info");
      this.uiState.clearResultsSelection();
      const results = this.portfolioResultsCalculator.calculate(tabs, firstNValues, strategy, history);
      this.statusView.clear();
      this.uiState.setResults(results);
    } catch (error) {
      this.statusView.show(`Error: ${error.message}`, "error");
      this.logger.error(error);
    } finally {
      this.uiState.setProcessing(false);
    }
  }

  async ensureDataLoaded() {
    const context = this.buildLoadContext();
    if (!context) {
      return null;
    }

    if (this.loadedData && this.loadedCacheKey === context.cacheKey) {
      return this.loadedData;
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

    if (!forceReload && this.loadedData && this.loadedCacheKey === resolvedContext.cacheKey) {
      return this.loadedData;
    }

    this.uiState.setProcessing(true);
    this.uiState.setLoadButtonLabel("Loading data...");
    this.statusView.show("Loading data from Google Sheets...", "info");

    const loadPromise = this.processableTabsService
      .fetchAll(
        resolvedContext.spreadsheetId,
        resolvedContext.apiKey,
        (msg) => this.statusView.show(msg, "info"),
      )
      .then((loadedData) => {
        this.loadedData = loadedData;
        this.loadedCacheKey = resolvedContext.cacheKey;
        this.uiState.setLoadButtonLabel("Reload");
        this.statusView.show(`Loaded ${loadedData.tabs.length} tab(s).`, "info");
        return loadedData;
      })
      .catch((error) => {
        this.statusView.show(`Error: ${error.message}`, "error");
        this.logger.error(error);
        this.loadedData = null;
        this.loadedCacheKey = null;
        this.uiState.setLoadButtonLabel("Load data");
        return null;
      })
      .finally(() => {
        this.uiState.setProcessing(false);
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
      this.loadedData = null;
      this.loadedCacheKey = null;
      this.uiState.setLoadButtonLabel("Load data");
      return null;
    }

    if (!apiKey) {
      this.statusView.show("Please enter a Google API Key.", "error");
      this.loadedData = null;
      this.loadedCacheKey = null;
      this.uiState.setLoadButtonLabel("Load data");
      return null;
    }

    let spreadsheetId;
    try {
      spreadsheetId = this.spreadsheetIdExtractor.extract(urlInput);
    } catch (error) {
      this.statusView.show(error.message, "error");
      this.loadedData = null;
      this.loadedCacheKey = null;
      this.uiState.setLoadButtonLabel("Load data");
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
    if (parsed.minDeposit && this.minDepositElement) {
      this.minDepositElement.value = parsed.minDeposit;
    }
    if (parsed.minInvestment && this.minInvestmentElement) {
      this.minInvestmentElement.value = parsed.minInvestment;
    }
  }

  parseStrategyInputs() {
    const minDeposit = this.#parsePositiveNumber(
      this.minDepositElement?.value,
      "Please enter a valid minimum deposit amount greater than 0.",
    );
    if (minDeposit == null) {
      return null;
    }

    const minInvestment = this.#parsePositiveNumber(
      this.minInvestmentElement?.value,
      "Please enter a valid minimum investment amount greater than 0.",
    );
    if (minInvestment == null) {
      return null;
    }

    const smoothN = this.#parsePositiveNumber(
      this.smoothNElement?.value,
      "Please enter a valid Smooth N value greater than 0.",
    );
    if (smoothN == null) {
      return null;
    }

    let saleBlockLookbacks;
    try {
      saleBlockLookbacks = this.saleBlockLookbackParser
        ? this.saleBlockLookbackParser.parse(this.saleBlockElement?.value)
        : [];
    } catch (error) {
      this.statusView.show(error.message, "error");
      return null;
    }

    return {
      minDeposit,
      minInvestment,
      smoothN,
      saleBlockLookbacks,
    };
  }

  #parsePositiveNumber(rawValue, validationMessage) {
    const value = Number(rawValue);
    if (!Number.isFinite(value) || value <= 0) {
      this.statusView.show(validationMessage, "error");
      return null;
    }
    return value;
  }
}
