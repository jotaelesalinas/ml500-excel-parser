import { SaleBlockHistoryValidator } from "../src/core/SaleBlockHistoryValidator.js";
import { SessionSeries } from "../src/core/SessionSeries.js";

describe("SaleBlockHistoryValidator", () => {
  const indexSeries = new SessionSeries([
    { date: "2025-01-02", value: 100 },
    { date: "2025-01-03", value: 90 },
  ]);

  function historyWith(overrides = {}) {
    return {
      indexSeries,
      priceSeriesByTicker: new Map([
        ["AAPL", new SessionSeries([{ date: "2025-01-06", value: 45 }])],
      ]),
      hasIndexTab: true,
      hasPricesTab: true,
      issues: [],
      ...overrides,
    };
  }

  function tabsWith(entries) {
    return [{ name: "Tab A", entries }];
  }

  it("checks nothing while the sale block field is empty", () => {
    const result = new SaleBlockHistoryValidator().validate({
      tabs: tabsWith([{ ticker: "MSFT", fechac: "2025-01-02", fechav: "2025-01-03" }]),
      firstNValues: [4],
      lookbacks: [],
      history: { indexSeries: null, priceSeriesByTicker: new Map(), issues: ["ignored"] },
    });

    expect(result).toEqual({ errors: [], warnings: [] });
  });

  it("reports the history tabs the spreadsheet does not have", () => {
    const result = new SaleBlockHistoryValidator().validate({
      tabs: tabsWith([]),
      firstNValues: [4],
      lookbacks: [2],
      history: null,
    });

    expect(result.errors).toEqual([
      '"Block sales S&P 500 -D" needs the index history: add an "Index hist" tab to the spreadsheet, or clear the field.',
      '"Block sales S&P 500 -D" needs the price history: add a "Prices hist" tab to the spreadsheet, or clear the field.',
    ]);
  });

  it("tells a tab that is there but unreadable apart from a missing one", () => {
    const errors = new SaleBlockHistoryValidator().validateHistory({
      lookbacks: [2],
      history: {
        indexSeries: new SessionSeries([]),
        priceSeriesByTicker: new Map([["AAPL", new SessionSeries([])]]),
        hasIndexTab: true,
        hasPricesTab: true,
      },
    });

    expect(errors).toEqual([
      '"Block sales S&P 500 -D" needs the index history, but the "Index hist" tab has no readable session: row 1 must hold a "Fecha" column followed by a "Valor" column, with dates written as YYYY-MM-DD.',
      '"Block sales S&P 500 -D" needs the price history, but the "Prices hist" tab has no readable price: row 1 must hold "Fecha" and then one column per ticker, with dates written as YYYY-MM-DD.',
    ]);
  });

  it("passes the tab warnings through and finds nothing else wrong", () => {
    const result = new SaleBlockHistoryValidator().validate({
      tabs: tabsWith([{ ticker: "AAPL", fechac: "2025-01-02", fechav: "2025-01-03" }]),
      firstNValues: [4],
      lookbacks: [2],
      history: historyWith({ issues: ['"Prices hist": row 9 is odd.'] }),
    });

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual(['"Prices hist": row 9 is odd.']);
  });

  it("warns about a sold ticker with no price after its sale date", () => {
    const result = new SaleBlockHistoryValidator().validate({
      tabs: tabsWith([
        { ticker: "AAPL", fechac: "2025-01-02", fechav: "2025-01-03" },
        { ticker: "MSFT", fechac: "2025-01-02", fechav: "2025-01-03" },
        { ticker: "GOOG", fechac: "2025-01-02", fechav: "2025-01-07" },
        { ticker: "NVDA", fechac: "2025-01-02", precioa: "120" },
      ]),
      firstNValues: [4],
      lookbacks: [2],
      history: historyWith(),
    });

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([
      'The "Prices hist" tab has no price for MSFT after 2025-01-03 (sold in "Tab A"), so the calculation stops if that sale is held back.',
      'The "Prices hist" tab has no price for GOOG after 2025-01-07 (sold in "Tab A"), so the calculation stops if that sale is held back.',
    ]);
  });

  it("only looks at the positions the First N values keep", () => {
    const entries = [
      { ticker: "AAPL", fechac: "2025-01-02", fechav: "2025-01-03" },
      { ticker: "MSFT", fechac: "2025-01-02", fechav: "2025-01-03" },
    ];

    const result = new SaleBlockHistoryValidator().validate({
      tabs: tabsWith(entries),
      firstNValues: [1],
      lookbacks: [2],
      history: historyWith(),
    });

    expect(result.warnings).toEqual([]);
  });

  it("counts the extra sales once the list gets long", () => {
    const entries = Array.from({ length: 7 }, (_, index) => ({
      ticker: `T${index}`,
      fechac: "2025-01-02",
      fechav: "2025-01-03",
    }));

    const result = new SaleBlockHistoryValidator().validate({
      tabs: tabsWith(entries),
      firstNValues: [10],
      lookbacks: [2],
      history: historyWith(),
    });

    expect(result.warnings.length).toBe(6);
    expect(result.warnings[5]).toBe(
      "And 2 more sale(s) with no price history after their sale date.",
    );
  });

  // The stop reads the running maximum from the purchase, so a position whose prices
  // start later cannot be watched at all.
  describe("with a tracking stop loss", () => {
    it("refuses a position with no price on or before its purchase", () => {
      const result = new SaleBlockHistoryValidator().validate({
        tabs: tabsWith([
          { ticker: "AAPL", fechac: "2025-01-02", fechav: "2025-01-07" },
          { ticker: "NVDA", fechac: "2025-01-02", precioa: "120" },
        ]),
        firstNValues: [4],
        lookbacks: [2],
        trackingStopPct: 20,
        history: historyWith(),
      });

      expect(result.errors).toEqual([
        '"Tracking stop loss" needs the price history of AAPL from its purchase on 2025-01-02 (bought in '
          + '"Tab A"), but the "Prices hist" tab has no price for AAPL on or before that date.',
        '"Tracking stop loss" needs the price history of NVDA from its purchase on 2025-01-02 (bought in '
          + '"Tab A"), but the "Prices hist" tab has no price for NVDA on or before that date.',
      ]);
      // Nothing else is reported while the calculation cannot run anyway.
      expect(result.warnings).toEqual([]);
    });

    it("says nothing when every purchase is covered", () => {
      const result = new SaleBlockHistoryValidator().validate({
        tabs: tabsWith([{ ticker: "AAPL", fechac: "2025-01-06", fechav: "2025-01-07" }]),
        firstNValues: [4],
        lookbacks: [2],
        trackingStopPct: 20,
        history: historyWith(),
      });

      expect(result.errors).toEqual([]);
    });

    it("counts the extra positions once the list gets long", () => {
      const entries = Array.from({ length: 7 }, (_, index) => ({
        ticker: `T${index}`,
        fechac: "2025-01-02",
        precioa: "120",
      }));

      const result = new SaleBlockHistoryValidator().validate({
        tabs: tabsWith(entries),
        firstNValues: [10],
        lookbacks: [2],
        trackingStopPct: 20,
        history: historyWith(),
      });

      expect(result.errors.length).toBe(6);
      expect(result.errors[5]).toBe(
        "And 2 more position(s) with no price history on their purchase date.",
      );
    });
  });
});
