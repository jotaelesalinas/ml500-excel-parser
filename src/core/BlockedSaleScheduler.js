import { SALE_BLOCK_LABEL, PRICE_HISTORY_TAB, defaultTodayProvider } from "../config/constants.js";
import { normalizeTicker } from "./PriceHistoryParser.js";

// Holds back the sales the sheet already decided (FechaV / PrecioV) while the index is
// down over any of the configured lookbacks, and re-prices them with the real quote of
// the session when they finally go through.
export class BlockedSaleScheduler {
  constructor({
    indexSeries,
    priceSeriesByTicker = new Map(),
    lookbacks = [],
    todayProvider = defaultTodayProvider,
  }) {
    this.indexSeries = indexSeries;
    this.priceSeriesByTicker = priceSeriesByTicker;
    this.lookbacks = lookbacks;
    this.todayProvider = todayProvider;
    this.blockedByDate = new Map();
  }

  // The index is read on the session covering the given day, so a sale ordered on a
  // weekend or a holiday inherits the state of the previous session.
  isBlocked(date) {
    const cached = this.blockedByDate.get(date);
    if (cached != null) {
      return cached;
    }

    const blocked = this.lookbacks.some((sessionCount) => {
      const changePct = this.indexSeries.changePctOverSessions(date, sessionCount);
      return changePct != null && changePct < 0;
    });

    this.blockedByDate.set(date, blocked);
    return blocked;
  }

  apply(movements) {
    if (this.lookbacks.length === 0) {
      return movements;
    }

    return movements.map((movement) => (movement.action === "sell" ? this.#rescheduleSale(movement) : movement));
  }

  #rescheduleSale(movement) {
    if (!this.isBlocked(movement.date)) {
      return movement;
    }

    const sessions = this.#sessionsAfter(movement);
    const unblocked = sessions.find((session) => !this.isBlocked(session.date));
    if (unblocked) {
      return {
        ...movement,
        date: unblocked.date,
        amount: this.#amountAt(movement, unblocked),
        blockedFrom: movement.date,
      };
    }

    // Still blocked with the history exhausted: the position was never sold, so it is
    // valued like any other open position, at the last price available.
    const last = sessions[sessions.length - 1];
    return {
      ...movement,
      action: "valueToday",
      date: this.todayProvider(),
      amount: this.#amountAt(movement, last),
      blockedFrom: movement.date,
    };
  }

  #sessionsAfter(movement) {
    const series = this.priceSeriesByTicker.get(normalizeTicker(movement.ticker));
    const sessions = series ? series.sessionsAfter(movement.date) : [];
    if (sessions.length === 0) {
      throw new Error(
        `"${SALE_BLOCK_LABEL}" held back the sale of ${movement.ticker} ordered on ${movement.date}, but the "${PRICE_HISTORY_TAB}" tab has no price for ${movement.ticker} after that date.`,
      );
    }

    return sessions;
  }

  #amountAt(movement, session) {
    const quantity = Number(movement.qty);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error(`Cannot re-price the sale of ${movement.ticker} ordered on ${movement.date}: missing quantity.`);
    }

    return +(quantity * session.value).toFixed(2);
  }
}
