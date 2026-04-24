import { AppConfig } from "../config.js";

export class GoogleSheetsService {
    constructor(sheetRowParser, fetchImpl = (...args) => fetch(...args)) {
        this.sheetRowParser = sheetRowParser;
        this.fetchImpl = fetchImpl;
    }

    async fetchConfiguredTabs(spreadsheetId, apiKey) {
        const availableTabs = await this.#fetchSheetTabs(spreadsheetId, apiKey);
        const tabs = [];

        for (const tabName of AppConfig.tabNames) {
            if (!availableTabs.includes(tabName)) {
                console.warn(`Sheet "${tabName}" not found. Available: ${availableTabs.join(", ")}`);
                tabs.push([]);
                continue;
            }

            const rows = await this.#fetchSheetValues(spreadsheetId, tabName, apiKey);
            tabs.push(this.sheetRowParser.parse(rows));
        }

        return tabs;
    }

    async #fetchSheetTabs(spreadsheetId, apiKey) {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?key=${encodeURIComponent(apiKey)}&fields=sheets.properties.title`;
        const response = await this.fetchImpl(url);

        if (!response.ok) {
            const body = await response.text();
            throw new Error(`Failed to fetch spreadsheet metadata (${response.status}): ${body}`);
        }

        const data = await response.json();
        return data.sheets.map(sheet => sheet.properties.title);
    }

    async #fetchSheetValues(spreadsheetId, sheetName, apiKey) {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}?key=${encodeURIComponent(apiKey)}`;
        const response = await this.fetchImpl(url);

        if (!response.ok) {
            const body = await response.text();
            throw new Error(`Failed to fetch sheet "${sheetName}" (${response.status}): ${body}`);
        }

        const data = await response.json();
        return data.values || [];
    }
}
