export class GoogleSheetsApiClient {
  constructor(fetchFn) {
    const resolvedFetchFn =
      fetchFn ||
      ((...args) => {
        if (typeof globalThis.fetch !== "function") {
          throw new Error("Fetch API is not available in this environment.");
        }
        return globalThis.fetch(...args);
      });

    this.fetchFn = resolvedFetchFn;
  }

  async fetchSheetTabs(spreadsheetId, apiKey) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?key=${encodeURIComponent(apiKey)}&fields=sheets.properties.title`;
    const response = await this.fetchFn(url);

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Failed to fetch spreadsheet metadata (${response.status}): ${body}`);
    }

    const data = await response.json();
    return data.sheets.map((sheet) => sheet.properties.title);
  }

  async fetchSheetValues(spreadsheetId, sheetName, apiKey) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}?key=${encodeURIComponent(apiKey)}`;
    const response = await this.fetchFn(url);

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Failed to fetch sheet "${sheetName}" (${response.status}): ${body}`);
    }

    const data = await response.json();
    return data.values || [];
  }
}
