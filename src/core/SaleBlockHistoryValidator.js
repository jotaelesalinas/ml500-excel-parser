import { INDEX_HISTORY_TAB, PRICE_HISTORY_TAB, SALE_BLOCK_LABEL } from "../config/constants.js";
import { FirstNFilter } from "./FirstNFilter.js";
import { normalizeTicker } from "./PriceHistoryParser.js";

const MAX_LISTED_SALES = 5;

// Checks that the sale-block field has the history it needs before anything is
// calculated. Errors stop the calculation (no index or no price at all, so no held-back
// sale could ever be re-priced); warnings only say what may go wrong later, such as a
// ticker that was sold but has no price after its sale date.
export class SaleBlockHistoryValidator {
  constructor({ firstNFilter = new FirstNFilter() } = {}) {
    this.firstNFilter = firstNFilter;
  }

  validate({ tabs = [], firstNValues = [], lookbacks = [], history = null }) {
    if (!this.#isEnabled(lookbacks)) {
      return { errors: [], warnings: [] };
    }

    const errors = this.validateHistory({ lookbacks, history });
    const warnings = [...(history?.issues || [])];
    if (errors.length === 0) {
      warnings.push(...this.#missingSaleWarnings(tabs, firstNValues, history));
    }

    return { errors, warnings };
  }

  // The part the calculation cannot work around. The calculator checks it too, so the
  // same wording is reported wherever the problem is caught.
  validateHistory({ lookbacks = [], history = null }) {
    if (!this.#isEnabled(lookbacks)) {
      return [];
    }

    const errors = [];
    const indexSeries = history?.indexSeries;
    if (!indexSeries || indexSeries.isEmpty()) {
      errors.push(
        history?.hasIndexTab
          ? `"${SALE_BLOCK_LABEL}" needs the index history, but the "${INDEX_HISTORY_TAB}" tab has no readable session: row 1 must hold a "Fecha" column followed by a "Valor" column, with dates written as YYYY-MM-DD.`
          : `"${SALE_BLOCK_LABEL}" needs the index history: add an "${INDEX_HISTORY_TAB}" tab to the spreadsheet, or clear the field.`,
      );
    }

    if (!this.#hasAnyPrice(history)) {
      errors.push(
        history?.hasPricesTab
          ? `"${SALE_BLOCK_LABEL}" needs the price history, but the "${PRICE_HISTORY_TAB}" tab has no readable price: row 1 must hold "Fecha" and then one column per ticker, with dates written as YYYY-MM-DD.`
          : `"${SALE_BLOCK_LABEL}" needs the price history: add a "${PRICE_HISTORY_TAB}" tab to the spreadsheet, or clear the field.`,
      );
    }

    return errors;
  }

  #isEnabled(lookbacks) {
    return Array.isArray(lookbacks) && lookbacks.length > 0;
  }

  #hasAnyPrice(history) {
    const priceSeriesByTicker = history?.priceSeriesByTicker;
    if (!priceSeriesByTicker || typeof priceSeriesByTicker.values !== "function") {
      return false;
    }

    return [...priceSeriesByTicker.values()].some((series) => series && !series.isEmpty());
  }

  // A sale is only re-priced when the index holds it back, so a sold ticker with no
  // price after its sale date is a warning: it stops the calculation only if that day
  // turns out to be blocked.
  #missingSaleWarnings(tabs, firstNValues, history) {
    const priceSeriesByTicker = history?.priceSeriesByTicker;
    const missing = new Map();

    (Array.isArray(tabs) ? tabs : []).forEach((tab) => {
      this.#soldPositions(tab, firstNValues).forEach(({ ticker, saleDate }) => {
        const series = priceSeriesByTicker?.get(ticker) || null;
        if (series && series.sessionsAfter(saleDate).length > 0) {
          return;
        }

        const key = `${ticker}@${saleDate}`;
        if (!missing.has(key)) {
          missing.set(key, { ticker, saleDate, tabName: tab?.name });
        }
      });
    });

    const listed = [...missing.values()];
    const warnings = listed.slice(0, MAX_LISTED_SALES).map(
      ({ ticker, saleDate, tabName }) =>
        `The "${PRICE_HISTORY_TAB}" tab has no price for ${ticker} after ${saleDate} (sold in "${tabName}"), so the calculation stops if that sale is held back.`,
    );

    if (listed.length > MAX_LISTED_SALES) {
      warnings.push(
        `And ${listed.length - MAX_LISTED_SALES} more sale(s) with no price history after their sale date.`,
      );
    }

    return warnings;
  }

  #soldPositions(tab, firstNValues) {
    const entries = Array.isArray(tab?.entries) ? tab.entries : [];
    const counts = Array.isArray(firstNValues) ? firstNValues.filter((value) => value > 0) : [];
    const selected = counts.length === 0
      ? entries
      : counts.flatMap((firstN) => this.firstNFilter.filter(entries, firstN));

    return selected
      .map((entry) => ({
        ticker: normalizeTicker(entry?.ticker),
        saleDate: String(entry?.fechav ?? "").trim(),
      }))
      .filter(({ ticker, saleDate }) => ticker !== "" && saleDate !== "");
  }
}
