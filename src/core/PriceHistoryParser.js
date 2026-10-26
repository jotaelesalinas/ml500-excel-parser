import { SessionSeries } from "./SessionSeries.js";
import { normalizeSheetHeader, parseSheetDate, parseSheetNumber } from "./sheetValues.js";

const DATE_HEADER = "fecha";
const WEEKDAY_HEADER = "dia";
// The sheet keeps a "_SAMPLE_" column to copy the price formula from; it never quotes.
const SAMPLE_HEADER = "_sample_";

export function normalizeTicker(rawTicker) {
  return String(rawTicker ?? "").trim().toUpperCase();
}

// Reads the per-share price history tab: a single "Fecha" column with every calendar
// day, the "Día" weekday helper next to it, and then one close-price column per ticker
// with the ticker as its row-1 header. Days that did not quote hold "#N/A" and are
// skipped, so each series ends up with sessions only.
export class PriceHistoryParser {
  parse(rows) {
    const seriesByTicker = new Map();
    if (!Array.isArray(rows) || rows.length < 2) {
      return seriesByTicker;
    }

    const headers = (rows[0] || []).map(normalizeSheetHeader);
    const dateColumn = headers.indexOf(DATE_HEADER);
    if (dateColumn < 0) {
      return seriesByTicker;
    }

    const weekdayColumn = headers[dateColumn + 1] === WEEKDAY_HEADER ? dateColumn + 1 : -1;
    const dates = rows.slice(1).map((row) => parseSheetDate(row?.[dateColumn]));
    const sessionsByTicker = new Map();

    headers.forEach((header, column) => {
      if (column === dateColumn || column === weekdayColumn || header === SAMPLE_HEADER) {
        return;
      }

      const ticker = normalizeTicker((rows[0] || [])[column]);
      if (ticker === "") {
        return;
      }

      const sessions = sessionsByTicker.get(ticker) || [];
      rows.slice(1).forEach((row, rowIndex) => {
        const date = dates[rowIndex];
        const value = parseSheetNumber(row?.[column]);
        if (date != null && value != null) {
          sessions.push({ date, value });
        }
      });
      sessionsByTicker.set(ticker, sessions);
    });

    sessionsByTicker.forEach((sessions, ticker) => {
      seriesByTicker.set(ticker, new SessionSeries(sessions));
    });

    return seriesByTicker;
  }
}
