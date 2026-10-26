import { INDEX_HISTORY_TAB, PRICE_HISTORY_TAB, SALE_BLOCK_LABEL } from "../config/constants.js";

function isSameTabName(left, right) {
  return String(left).trim().toLowerCase() === String(right).trim().toLowerCase();
}

export class ProcessableTabsService {
  constructor({ sheetsApiClient, headerValidator, rowParser, indexHistoryParser = null, priceHistoryParser = null, logger = console }) {
    this.sheetsApiClient = sheetsApiClient;
    this.headerValidator = headerValidator;
    this.rowParser = rowParser;
    this.indexHistoryParser = indexHistoryParser;
    this.priceHistoryParser = priceHistoryParser;
    this.logger = logger;
  }

  async fetchAll(spreadsheetId, apiKey, onProgress = () => {}) {
    onProgress("Fetching sheet list...");
    const availableTabs = await this.sheetsApiClient.fetchSheetTabs(spreadsheetId, apiKey);
    const tabs = [];
    const history = {
      indexSeries: null,
      priceSeriesByTicker: new Map(),
      hasIndexTab: false,
      hasPricesTab: false,
      issues: [],
    };

    for (const [i, tabName] of availableTabs.entries()) {
      onProgress(`Fetching tab "${tabName}" (${i + 1}/${availableTabs.length})...`);
      const rows = await this.sheetsApiClient.fetchSheetValues(spreadsheetId, tabName, apiKey);

      if (isSameTabName(tabName, INDEX_HISTORY_TAB) && this.indexHistoryParser) {
        const { series, issues } = this.indexHistoryParser.parse(rows);
        history.indexSeries = series;
        history.hasIndexTab = true;
        this.#reportIssues(history, issues);
        this.logger.info(`Loaded ${series.length} index session(s) from "${tabName}".`);
        continue;
      }

      if (isSameTabName(tabName, PRICE_HISTORY_TAB) && this.priceHistoryParser) {
        const { seriesByTicker, issues } = this.priceHistoryParser.parse(rows);
        history.priceSeriesByTicker = seriesByTicker;
        history.hasPricesTab = true;
        this.#reportIssues(history, issues);
        this.logger.info(`Loaded price history for ${seriesByTicker.size} ticker(s) from "${tabName}".`);
        continue;
      }

      if (!this.headerValidator.hasProcessableHeaders(rows)) {
        this.#reportIssues(history, [
          `Skipped the "${tabName}" tab: row 1 does not hold the required headers (${this.headerValidator.requiredFieldSlugs.join(", ")}).`,
        ]);
        continue;
      }

      tabs.push({
        name: tabName,
        entries: this.rowParser.parse(rows),
      });
    }

    this.#reportMissingHistoryTabs(history);

    if (tabs.length === 0) {
      throw new Error(
        `No processable sheets found. Required headers in row 1: ${this.headerValidator.requiredFieldSlugs.join(", ")}`,
      );
    }

    return { tabs, history };
  }

  // A missing history tab only matters once the sale-block field is in use, so it is
  // reported as a warning here and turned into an error by the sale-block validator.
  #reportMissingHistoryTabs(history) {
    const missing = [];
    if (this.indexHistoryParser && !history.hasIndexTab) {
      missing.push(INDEX_HISTORY_TAB);
    }
    if (this.priceHistoryParser && !history.hasPricesTab) {
      missing.push(PRICE_HISTORY_TAB);
    }
    if (missing.length === 0) {
      return;
    }

    const names = missing.map((tabName) => `"${tabName}"`).join(" or ");
    this.#reportIssues(history, [
      `No ${names} tab found, so "${SALE_BLOCK_LABEL}" cannot hold back any sale; clear that field if you do not use it.`,
    ]);
  }

  #reportIssues(history, issues) {
    issues.forEach((issue) => {
      history.issues.push(issue);
      this.logger.warn(issue);
    });
  }
}
