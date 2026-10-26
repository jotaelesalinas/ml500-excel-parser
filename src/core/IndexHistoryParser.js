import { SessionSeries } from "./SessionSeries.js";
import { parseSheetDate, parseSheetNumber } from "./sheetValues.js";

function normalizeHeader(rawHeader) {
  return String(rawHeader ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// Reads the index history tab, where the same year-by-year block repeats across the
// row: a date column, an optional weekday column and a value column. Columns are
// located by their header ("Fecha" / "Valor") instead of by position, so extra or
// missing helper columns do not matter.
export class IndexHistoryParser {
  parse(rows) {
    if (!Array.isArray(rows) || rows.length < 2) {
      return new SessionSeries([]);
    }

    const headers = (rows[0] || []).map(normalizeHeader);
    const columnPairs = this.#findColumnPairs(headers);
    const sessions = [];

    rows.slice(1).forEach((row) => {
      columnPairs.forEach(({ dateColumn, valueColumn }) => {
        const date = parseSheetDate(row?.[dateColumn]);
        const value = parseSheetNumber(row?.[valueColumn]);
        if (date != null && value != null) {
          sessions.push({ date, value });
        }
      });
    });

    return new SessionSeries(sessions);
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
