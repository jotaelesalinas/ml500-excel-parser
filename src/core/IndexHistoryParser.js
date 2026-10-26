import { INDEX_HISTORY_TAB } from "../config/constants.js";
import { SessionSeries } from "./SessionSeries.js";
import { SheetIssueLog } from "./SheetIssueLog.js";
import {
  describeSheetCell,
  isEmptyOrNotAvailable,
  normalizeSheetHeader,
  parseSheetDate,
  parseSheetNumber,
} from "./sheetValues.js";

const EXPECTED_LAYOUT = 'row 1 must hold a "Fecha" column followed by a "Valor" column';

// Reads the index history tab, where the same year-by-year block repeats across the
// row: a date column, an optional weekday column and a value column. Columns are
// located by their header ("Fecha" / "Valor") instead of by position, so extra or
// missing helper columns do not matter. Anything unreadable is reported in `issues`
// instead of being silently ignored.
export class IndexHistoryParser {
  parse(rows) {
    const issueLog = new SheetIssueLog(INDEX_HISTORY_TAB);

    if (!Array.isArray(rows) || rows.length === 0) {
      issueLog.add(`the tab is empty; ${EXPECTED_LAYOUT}.`);
      return { series: new SessionSeries([]), issues: issueLog.list() };
    }

    const headers = (rows[0] || []).map(normalizeSheetHeader);
    const columnPairs = this.#findColumnPairs(headers);
    if (columnPairs.length === 0) {
      issueLog.add(`no "Fecha"/"Valor" column pair found; ${EXPECTED_LAYOUT}.`);
      return { series: new SessionSeries([]), issues: issueLog.list() };
    }

    const sessions = [];
    rows.slice(1).forEach((row, rowIndex) => {
      const rowNumber = rowIndex + 2;
      columnPairs.forEach(({ dateColumn, valueColumn }) => {
        const rawDate = row?.[dateColumn];
        const date = parseSheetDate(rawDate);
        if (date == null) {
          if (!isEmptyOrNotAvailable(rawDate)) {
            issueLog.addCapped(
              "cell(s) with an unusable date",
              `row ${rowNumber} holds ${describeSheetCell(rawDate)} under "Fecha" instead of a YYYY-MM-DD date; the value is ignored.`,
            );
          }
          return;
        }

        const rawValue = row?.[valueColumn];
        const value = parseSheetNumber(rawValue);
        if (value == null) {
          if (!isEmptyOrNotAvailable(rawValue)) {
            issueLog.addCapped(
              "unreadable value cell(s)",
              `row ${rowNumber} holds ${describeSheetCell(rawValue)} under "Valor" instead of a number; the value is ignored.`,
            );
          }
          return;
        }

        sessions.push({ date, value });
      });
    });

    if (sessions.length === 0) {
      issueLog.add("no readable session found under the \"Fecha\"/\"Valor\" columns.");
    }

    return { series: new SessionSeries(sessions), issues: issueLog.list() };
  }

  #findColumnPairs(headers) {
    const pairs = [];

    headers.forEach((header, columnIndex) => {
      if (header !== "fecha") {
        return;
      }

      const valueColumn = headers.findIndex(
        (candidate, candidateIndex) => candidateIndex > columnIndex && candidate === "valor",
      );
      if (valueColumn >= 0) {
        pairs.push({ dateColumn: columnIndex, valueColumn });
      }
    });

    return pairs;
  }
}
