import { PRICE_HISTORY_TAB } from "../config/constants.js";
import { SessionSeries } from "./SessionSeries.js";
import { SheetIssueLog } from "./SheetIssueLog.js";
import {
  describeSheetCell,
  isEmptyOrNotAvailable,
  isEmptySheetRow,
  normalizeSheetHeader,
  parseSheetDate,
  parseSheetNumber,
} from "./sheetValues.js";

const DATE_HEADER = "fecha";
const WEEKDAY_HEADER = "dia";
// The sheet keeps a "_SAMPLE_" column to copy the price formula from; it never quotes.
const SAMPLE_HEADER = "_sample_";
const EXPECTED_LAYOUT =
  'row 1 must hold "Fecha", the "Día" helper and then one column per ticker';

export function normalizeTicker(rawTicker) {
  return String(rawTicker ?? "").trim().toUpperCase();
}

// Reads the per-share price history tab: a single "Fecha" column with every calendar
// day, the "Día" weekday helper next to it, and then one close-price column per ticker
// with the ticker as its row-1 header. Days that did not quote hold "#N/A" and are
// skipped, so each series ends up with sessions only. Everything the tab does not look
// like is reported in `issues` instead of being silently ignored.
export class PriceHistoryParser {
  parse(rows) {
    const issueLog = new SheetIssueLog(PRICE_HISTORY_TAB);
    const seriesByTicker = new Map();
    const result = () => ({ seriesByTicker, issues: issueLog.list() });

    if (!Array.isArray(rows) || rows.length === 0) {
      issueLog.add(`the tab is empty; ${EXPECTED_LAYOUT}.`);
      return result();
    }

    const headerRow = rows[0] || [];
    const headers = headerRow.map(normalizeSheetHeader);
    const dateColumn = headers.indexOf(DATE_HEADER);
    if (dateColumn < 0) {
      issueLog.add(`no "Fecha" column found; ${EXPECTED_LAYOUT}.`);
      return result();
    }

    const weekdayColumn = headers[dateColumn + 1] === WEEKDAY_HEADER ? dateColumn + 1 : -1;
    const tickerColumns = this.#findTickerColumns(headerRow, headers, dateColumn, weekdayColumn);
    if (tickerColumns.length === 0) {
      issueLog.add(`no ticker column found; ${EXPECTED_LAYOUT}.`);
      return result();
    }

    if (rows.length < 2) {
      issueLog.add("the tab has a header row but no prices.");
      return result();
    }

    const sessionsByTicker = new Map(tickerColumns.map(({ ticker }) => [ticker, []]));

    rows.slice(1).forEach((row, rowIndex) => {
      const rowNumber = rowIndex + 2;
      const date = parseSheetDate(row?.[dateColumn]);
      if (date == null) {
        if (!isEmptySheetRow(row)) {
          issueLog.addCapped(
            "row(s) with an unusable date",
            `row ${rowNumber} holds ${describeSheetCell(row?.[dateColumn])} under "Fecha" instead of a YYYY-MM-DD date; the row is ignored.`,
          );
        }
        return;
      }

      tickerColumns.forEach(({ ticker, column }) => {
        const rawValue = row?.[column];
        const value = parseSheetNumber(rawValue);
        if (value != null) {
          sessionsByTicker.get(ticker).push({ date, value });
          return;
        }
        if (!isEmptyOrNotAvailable(rawValue)) {
          issueLog.addCapped(
            "unreadable price cell(s)",
            `row ${rowNumber} holds ${describeSheetCell(rawValue)} under ${ticker} instead of a price; the cell is ignored.`,
          );
        }
      });
    });

    sessionsByTicker.forEach((sessions, ticker) => {
      if (sessions.length === 0) {
        issueLog.add(`the ${ticker} column has no price at all.`);
      }
      seriesByTicker.set(ticker, new SessionSeries(sessions));
    });

    return result();
  }

  #findTickerColumns(headerRow, headers, dateColumn, weekdayColumn) {
    const columns = [];

    headers.forEach((header, column) => {
      if (column === dateColumn || column === weekdayColumn || header === SAMPLE_HEADER) {
        return;
      }

      const ticker = normalizeTicker(headerRow[column]);
      if (ticker !== "") {
        columns.push({ ticker, column });
      }
    });

    return columns;
  }
}
