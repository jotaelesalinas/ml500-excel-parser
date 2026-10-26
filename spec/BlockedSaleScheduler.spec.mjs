import { BlockedSaleScheduler } from "../src/core/BlockedSaleScheduler.js";
import { SessionSeries } from "../src/core/SessionSeries.js";

describe("BlockedSaleScheduler", () => {
  // With a 2-session lookback: 01-03 (-10%) and 01-06 (-5% against 01-02) are down, so
  // sales ordered there are held back; 01-07 is up again and lets them through.
  const indexSessions = [
    { date: "2025-01-01", value: 100 },
    { date: "2025-01-02", value: 100 },
    { date: "2025-01-03", value: 90 },
    { date: "2025-01-06", value: 95 },
    { date: "2025-01-07", value: 110 },
  ];

  const priceSessions = [
    { date: "2025-01-02", value: 55 },
    { date: "2025-01-03", value: 50 },
    { date: "2025-01-06", value: 45 },
    { date: "2025-01-07", value: 60 },
  ];

  function createScheduler({
    indexUpTo = "2025-01-07",
    pricesUpTo = "2025-01-07",
    lookbacks = [2],
    tickers = ["AAPL"],
  } = {}) {
    const priceSeriesByTicker = new Map(
      tickers.map((ticker) => [
        ticker,
        new SessionSeries(priceSessions.filter((session) => session.date <= pricesUpTo)),
      ]),
    );

    return new BlockedSaleScheduler({
      indexSeries: new SessionSeries(indexSessions.filter((session) => session.date <= indexUpTo)),
      priceSeriesByTicker,
      lookbacks,
      todayProvider: () => "2025-01-09",
    });
  }

  function sellMovement(date) {
    return { action: "sell", date, ticker: "AAPL", qty: 10, amount: 500, positionId: 1 };
  }

  it("flags a day as blocked when any lookback is negative", () => {
    const scheduler = createScheduler({ lookbacks: [1, 2] });

    // 01-06 rose 5.56% over one session but is still 5% below two sessions ago.
    expect(scheduler.isBlocked("2025-01-06")).toBeTrue();
    expect(scheduler.isBlocked("2025-01-03")).toBeTrue();
    expect(scheduler.isBlocked("2025-01-07")).toBeFalse();
  });

  it("does not block when there is not enough index history yet", () => {
    const scheduler = createScheduler();

    expect(scheduler.isBlocked("2025-01-01")).toBeFalse();
    expect(scheduler.isBlocked("2025-01-02")).toBeFalse();
    expect(scheduler.isBlocked("2024-12-31")).toBeFalse();
  });

  it("does not block on a flat index, only on a negative one", () => {
    const scheduler = new BlockedSaleScheduler({
      indexSeries: new SessionSeries([
        { date: "2025-01-01", value: 100 },
        { date: "2025-01-02", value: 100 },
      ]),
      lookbacks: [1],
    });

    expect(scheduler.isBlocked("2025-01-02")).toBeFalse();
  });

  it("leaves a sale untouched when the index is not down", () => {
    const movements = [sellMovement("2025-01-07")];

    expect(createScheduler().apply(movements)).toEqual(movements);
  });

  it("leaves every movement untouched when no lookback is configured", () => {
    const movements = [sellMovement("2025-01-03")];

    expect(createScheduler({ lookbacks: [] }).apply(movements)).toEqual(movements);
  });

  it("only touches sales", () => {
    const movements = [
      { action: "buy", date: "2025-01-03", ticker: "AAPL", qty: 10, amount: 500, positionId: 1 },
      { action: "valueToday", date: "2025-01-03", ticker: "AAPL", qty: 10, amount: 500, positionId: 1 },
    ];

    expect(createScheduler().apply(movements)).toEqual(movements);
  });

  it("delays a blocked sale to the first unblocked session and re-prices it there", () => {
    const [sale] = createScheduler().apply([sellMovement("2025-01-03")]);

    expect(sale).toEqual({
      action: "sell",
      date: "2025-01-07",
      ticker: "AAPL",
      qty: 10,
      amount: 600,
      positionId: 1,
      blockedFrom: "2025-01-03",
    });
  });

  it("reads the index of the previous session when the sale falls on a closed day", () => {
    // Saturday 01-04 inherits the state of Friday 01-03, which is blocked.
    const [sale] = createScheduler().apply([sellMovement("2025-01-04")]);

    expect(sale.date).toBe("2025-01-07");
    expect(sale.amount).toBe(600);
    expect(sale.blockedFrom).toBe("2025-01-04");
  });

  it("keeps the position open when the sale is still blocked at the end of the history", () => {
    const scheduler = createScheduler({ indexUpTo: "2025-01-06", pricesUpTo: "2025-01-06" });

    const [movement] = scheduler.apply([sellMovement("2025-01-03")]);

    expect(movement).toEqual({
      action: "valueToday",
      date: "2025-01-09",
      ticker: "AAPL",
      qty: 10,
      amount: 450,
      positionId: 1,
      blockedFrom: "2025-01-03",
    });
  });

  it("fails with an actionable message when the delayed ticker has no price history", () => {
    const scheduler = createScheduler({ tickers: [] });

    expect(() => scheduler.apply([sellMovement("2025-01-03")])).toThrowError(
      '"Block sales S&P 500 -D" held back the sale of AAPL ordered on 2025-01-03, but the "Prices hist" tab has no price for AAPL after that date.',
    );
  });

  it("fails when the price history stops on the day the sale was ordered", () => {
    const scheduler = createScheduler({ pricesUpTo: "2025-01-03" });

    expect(() => scheduler.apply([sellMovement("2025-01-03")])).toThrowError(/has no price for AAPL after that date/);
  });

  it("fails when a delayed sale has no quantity to re-price", () => {
    const scheduler = createScheduler();

    expect(() =>
      scheduler.apply([{ action: "sell", date: "2025-01-03", ticker: "AAPL", qty: 0, amount: 500, positionId: 1 }]),
    ).toThrowError("Cannot re-price the sale of AAPL ordered on 2025-01-03: missing quantity.");
  });
});
