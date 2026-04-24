import { AppConfig } from "../config.js";

export class SpreadsheetIdExtractor {
    extract(url) {
        const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
        if (!match) {
            throw new Error("Could not extract spreadsheet ID from URL.");
        }
        return match[1];
    }
}

export class SheetRowParser {
    parse(rows) {
        if (rows.length < 2) {
            return [];
        }

        const headers = rows[0].map(header => String(header).trim().toLowerCase());

        return rows.slice(1)
            .map(row => this.#mapRow(headers, row))
            .filter(entry => entry.ticker !== "");
    }

    #mapRow(headers, row) {
        const entry = {};

        AppConfig.fieldSlugs.forEach(slug => {
            const columnIndex = headers.indexOf(slug);
            entry[slug] = (columnIndex >= 0 && row[columnIndex] != null) ? String(row[columnIndex]).trim() : "";
        });

        return entry;
    }
}

export class BulkFormInputParser {
    parse(text) {
        const lines = String(text)
            .split(/\r?\n/g)
            .map(line => line.trim())
            .filter(Boolean);

        return {
            spreadsheetUrl: lines[0] || "",
            apiKey: lines[1] || "",
            firstN: lines[2] || "",
        };
    }
}
