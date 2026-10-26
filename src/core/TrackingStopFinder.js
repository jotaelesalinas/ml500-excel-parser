import { PRICE_HISTORY_TAB, TRACKING_STOP_LABEL } from "../config/constants.js";

// Watches a position session by session and says where its trailing stop loss actually
// sells it: the first close that sits `dropPct` percent or more below the highest close
// seen since the purchase *and* falls on a session where sales are not blocked.
//
// The stop is a condition, not a queued order. While sales are blocked the position
// keeps being watched: if the price climbs back above the stop level nothing is sold,
// and the maximum keeps trailing from there; if it is still below when sales reopen,
// that session is the sale.
//
// The running maximum is built from the price history alone, so the sheet's PrecioC
// never acts as the first maximum.
export class TrackingStopFinder {
  constructor(dropPct = 0) {
    const parsed = Number(dropPct);
    this.dropPct = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }

  isEnabled() {
    return this.dropPct > 0;
  }

  // The history has to reach back to the purchase: a maximum measured from a later
  // session would be wrong, and silently so, hiding the stops in between.
  findStopSale({ series, ticker, buyDate, throughDate = null, isBlocked = () => false }) {
    if (!this.isEnabled()) {
      return null;
    }

    if (!series || series.sessionAtOrBefore(buyDate) == null) {
      throw new Error(
        `"${TRACKING_STOP_LABEL}" needs the price history of ${ticker} from its purchase on ${buyDate}, but the "${PRICE_HISTORY_TAB}" tab has no price for ${ticker} on or before that date.`,
      );
    }

    const threshold = 1 - (this.dropPct / 100);
    let highest = 0;

    for (const session of series.sessionsFrom(buyDate)) {
      if (throughDate != null && session.date > throughDate) {
        return null;
      }
      if (highest > 0 && session.value <= highest * threshold && !isBlocked(session.date)) {
        return session;
      }
      highest = Math.max(highest, session.value);
    }

    return null;
  }
}
