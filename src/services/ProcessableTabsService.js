export class ProcessableTabsService {
  constructor({ sheetsApiClient, headerValidator, rowParser, logger = console }) {
    this.sheetsApiClient = sheetsApiClient;
    this.headerValidator = headerValidator;
    this.rowParser = rowParser;
    this.logger = logger;
  }

  async fetchAll(spreadsheetId, apiKey, onProgress = () => {}) {
    onProgress("Fetching sheet list...");
    const availableTabs = await this.sheetsApiClient.fetchSheetTabs(spreadsheetId, apiKey);
    const tabs = [];

    for (const [i, tabName] of availableTabs.entries()) {
      onProgress(`Fetching tab "${tabName}" (${i + 1}/${availableTabs.length})...`);
      const rows = await this.sheetsApiClient.fetchSheetValues(spreadsheetId, tabName, apiKey);

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

    return tabs;
  }
}
