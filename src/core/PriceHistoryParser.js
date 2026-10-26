import { SessionSeries } from "./SessionSeries.js";
import { parseSheetDate, parseSheetNumber } from "./sheetValues.js";

export function normalizeTicker(rawTicker) {
  return String(rawTicker ?? "").trim().toUpperCase();
}

// Reads the per-share price history tab. Columns come in pairs (date, close) because
// that is what a single GOOGLEFINANCE historical call spills into the sheet, and row 1
// carries the ticker above each pair.
export class PriceHistoryParser {
  parse(rows) {
    const seriesByTicker = new Map();
    if (!Array.isArray(rows) || rows.length < 2) {
      return seriesByTicker;
    }

    const headers = rows[0] || [];
    const sessionsByTicker = new Map();

    for (let dateColumn = 0; dateColumn < headers.length; dateColumn += 2) {
      const valueColumn = dateColumn + 1;
      const ticker = normalizeTicker(headers[dateColumn]) || normalizeTicker(headers[valueColumn]);
      if (ticker === "") {
        continue;
      }

      const sessions = sessionsByTicker.get(ticker) || [];
      rows.slice(1).forEach((row) => {
        const date = parseSheetDate(row?.[dateColumn]);
        const value = parseSheetNumber(row?.[valueColumn]);
        if (date != null && value != null) {
          sessions.push({ date, value });
        }
      });
      sessionsByTicker.set(ticker, sessions);
    }

    sessionsByTicker.forEach((sessions, ticker) => {
      seriesByTicker.set(ticker, new SessionSeries(sessions));
    });

    return seriesByTicker;
  }
}
