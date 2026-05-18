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
      throw this.#friendlyError("Could not read spreadsheet", response.status, body);
    }

    const data = await response.json();
    return data.sheets.map((sheet) => sheet.properties.title);
  }

  async fetchSheetValues(spreadsheetId, sheetName, apiKey) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}?key=${encodeURIComponent(apiKey)}`;
    const response = await this.fetchFn(url);

    if (!response.ok) {
      const body = await response.text();
      throw this.#friendlyError(`Could not read sheet "${sheetName}"`, response.status, body);
    }

    const data = await response.json();
    return data.values || [];
  }

  #friendlyError(context, status, rawBody) {
    try {
      const json = JSON.parse(rawBody);
      const msg = json?.error?.message;
      if (msg) return new Error(`${context}: ${msg}`);
    } catch {}

    if (status === 400) return new Error(`${context}: Bad request. Check the API key format.`);
    if (status === 403) return new Error(`${context}: Access denied. Make sure the spreadsheet is shared publicly and the API key is valid.`);
    if (status === 404) return new Error(`${context}: Not found. Check the spreadsheet URL.`);
    return new Error(`${context} (HTTP ${status}).`);
  }
}
