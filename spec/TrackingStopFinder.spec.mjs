import { TrackingStopFinder } from "../src/core/TrackingStopFinder.js";
import { SessionSeries } from "../src/core/SessionSeries.js";

describe("TrackingStopFinder", () => {
  // Bought at 100, peaks at 120, so a 20% stop sits at 96.
  const series = new SessionSeries([
    { date: "2025-01-02", value: 100 },
    { date: "2025-01-03", value: 120 },
    { date: "2025-01-06", value: 110 },
    { date: "2025-01-07", value: 96 },
    { date: "2025-01-08", value: 130 },
  ]);

  function findStopSale(finder, overrides = {}) {
    return finder.findStopSale({ series, ticker: "AAPL", buyDate: "2025-01-02", ...overrides });
  }

  it("is off without a percentage", () => {
    expect(new TrackingStopFinder().isEnabled()).toBeFalse();
    expect(new TrackingStopFinder(0).isEnabled()).toBeFalse();
    expect(new TrackingStopFinder("nope").isEnabled()).toBeFalse();
    expect(findStopSale(new TrackingStopFinder(0))).toBeNull();
  });

  it("sells on the first close that is the drop below the running maximum", () => {
    expect(findStopSale(new TrackingStopFinder(20))).toEqual({ date: "2025-01-07", value: 96 });
    // 110 is 8.33% off the peak, so a tighter stop sells one session earlier.
    expect(findStopSale(new TrackingStopFinder(5))).toEqual({ date: "2025-01-06", value: 110 });
  });

  it("never sells on the purchase session, which is the first maximum", () => {
    expect(findStopSale(new TrackingStopFinder(20), { buyDate: "2025-01-07" })).toBeNull();
  });

  it("finds nothing when the drop never happens", () => {
    expect(findStopSale(new TrackingStopFinder(25))).toBeNull();
  });

  it("stops looking after the date it is given", () => {
    expect(findStopSale(new TrackingStopFinder(20), { throughDate: "2025-01-06" })).toBeNull();
  });

  // The stop is a condition, not a queued order: a price back above the stop level
  // while sales are blocked cancels it, and the maximum keeps trailing.
  it("skips a blocked session and sells on the next one still below the stop", () => {
    const blocked = new SessionSeries([
      { date: "2025-01-02", value: 100 },
      { date: "2025-01-03", value: 120 },
      { date: "2025-01-06", value: 90 },
      { date: "2025-01-07", value: 92 },
    ]);

    const sale = new TrackingStopFinder(20).findStopSale({
      series: blocked,
      ticker: "AAPL",
      buyDate: "2025-01-02",
      isBlocked: (date) => date === "2025-01-06",
    });

    expect(sale).toEqual({ date: "2025-01-07", value: 92 });
  });

  it("does not sell when the price recovers while sales are blocked", () => {
    const sale = new TrackingStopFinder(20).findStopSale({
      series,
      ticker: "AAPL",
      buyDate: "2025-01-02",
      isBlocked: (date) => date === "2025-01-07",
    });

    expect(sale).toBeNull();
  });

  it("trails the maximum up again after a cancelled stop", () => {
    const recovered = new SessionSeries([
      { date: "2025-01-02", value: 100 },
      { date: "2025-01-03", value: 120 },
      { date: "2025-01-07", value: 96 },
      { date: "2025-01-08", value: 150 },
      { date: "2025-01-09", value: 125 },
      { date: "2025-01-10", value: 119 },
    ]);

    const sale = new TrackingStopFinder(20).findStopSale({
      series: recovered,
      ticker: "AAPL",
      buyDate: "2025-01-02",
      isBlocked: (date) => date === "2025-01-07",
    });

    // 125 is only 16.67% off the new 150 peak; 119 is 20.67% off it.
    expect(sale).toEqual({ date: "2025-01-10", value: 119 });
  });

  it("fails when the price history does not reach the purchase", () => {
    const message =
      '"Tracking stop loss" needs the price history of AAPL from its purchase on 2025-01-01, but the '
      + '"Prices hist" tab has no price for AAPL on or before that date.';

    expect(() => findStopSale(new TrackingStopFinder(20), { buyDate: "2025-01-01" })).toThrowError(message);
    expect(() => findStopSale(new TrackingStopFinder(20), { series: null })).toThrowError(/no price for AAPL on or before/);
  });
});
