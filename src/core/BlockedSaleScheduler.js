import { SALE_BLOCK_LABEL, PRICE_HISTORY_TAB, defaultTodayProvider } from "../config/constants.js";
import { normalizeTicker } from "./PriceHistoryParser.js";
import { TrackingStopFinder } from "./TrackingStopFinder.js";

// Decides when each position is actually sold while the block is on. Two things can
// sell it, and the index has the last word on both.
//
// The sheet's own sale (FechaV / PrecioV) is held back while the index is down over any
// of the configured lookbacks, and is re-priced with the real quote of the session when
// it finally goes through.
//
// The trailing stop loss watches every position from its purchase, the sheet's sales and
// the positions still open alike, and sells on the first session that is both below the
// stop level and not blocked. It is a condition checked session by session, so a price
// that climbs back above the stop level while sales are blocked simply cancels it.
export class BlockedSaleScheduler {
  constructor({
    indexSeries,
    priceSeriesByTicker = new Map(),
    lookbacks = [],
    trackingStopPct = 0,
    todayProvider = defaultTodayProvider,
    trackingStopFinder = null,
  }) {
    this.indexSeries = indexSeries;
    this.priceSeriesByTicker = priceSeriesByTicker;
    this.lookbacks = lookbacks;
    this.todayProvider = todayProvider;
    this.trackingStopFinder = trackingStopFinder || new TrackingStopFinder(trackingStopPct);
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

    const buyDateByPositionId = new Map(
      movements
        .filter((movement) => movement.action === "buy" && movement.positionId != null)
        .map((movement) => [movement.positionId, movement.date]),
    );

    return movements.map((movement) => {
      if (movement.action !== "sell" && movement.action !== "valueToday") {
        return movement;
      }

      const stopped = this.#applyTrackingStop(movement, buyDateByPositionId);
      if (stopped.stopLoss) {
        return stopped;
      }

      return movement.action === "sell" ? this.#rescheduleSale(movement) : movement;
    });
  }

  // Sells on the session that hit the stop with sales open, priced with that close. An
  // open position becomes a sale here; one whose stop never sells is left alone.
  #applyTrackingStop(movement, buyDateByPositionId) {
    if (!this.trackingStopFinder.isEnabled() || movement.positionId == null) {
      return movement;
    }

    const buyDate = buyDateByPositionId.get(movement.positionId);
    if (buyDate == null) {
      return movement;
    }

    const stopSale = this.trackingStopFinder.findStopSale({
      series: this.priceSeriesByTicker.get(normalizeTicker(movement.ticker)) || null,
      ticker: movement.ticker,
      buyDate,
      throughDate: movement.date,
      isBlocked: (date) => this.isBlocked(date),
    });

    // A stop on the day the sheet already sells on changes nothing, so PrecioV stands.
    if (stopSale == null || stopSale.date >= movement.date) {
      return movement;
    }

    return {
      ...movement,
      action: "sell",
      date: stopSale.date,
      amount: this.#amountAt(movement, stopSale),
      stopLoss: true,
    };
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
