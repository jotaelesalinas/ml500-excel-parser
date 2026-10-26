import { INDEX_HISTORY_TAB, PRICE_HISTORY_TAB } from "../config/constants.js";

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
    const history = { indexSeries: null, priceSeriesByTicker: new Map() };

    for (const [i, tabName] of availableTabs.entries()) {
      onProgress(`Fetching tab "${tabName}" (${i + 1}/${availableTabs.length})...`);
      const rows = await this.sheetsApiClient.fetchSheetValues(spreadsheetId, tabName, apiKey);

      if (isSameTabName(tabName, INDEX_HISTORY_TAB) && this.indexHistoryParser) {
        history.indexSeries = this.indexHistoryParser.parse(rows);
        this.logger.info(`Loaded ${history.indexSeries.length} index session(s) from "${tabName}".`);
        continue;
      }

      if (isSameTabName(tabName, PRICE_HISTORY_TAB) && this.priceHistoryParser) {
        history.priceSeriesByTicker = this.priceHistoryParser.parse(rows);
        this.logger.info(`Loaded price history for ${history.priceSeriesByTicker.size} ticker(s) from "${tabName}".`);
        continue;
      }

      if (!this.headerValidator.hasProcessableHeaders(rows)) {
        this.logger.info(`Skipping sheet "${tabName}" (missing required headers in row 1).`);
        continue;
      }

      tabs.push({
        name: tabName,
        entries: this.rowParser.parse(rows),
      });
    }

    if (tabs.length === 0) {
      throw new Error(
        `No processable sheets found. Required headers in row 1: ${this.headerValidator.requiredFieldSlugs.join(", ")}`,
      );
    }

    return { tabs, history };
  }
}
