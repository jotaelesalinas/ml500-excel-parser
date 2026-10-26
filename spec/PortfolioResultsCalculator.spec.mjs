import { PortfolioResultsCalculator } from "../src/services/PortfolioResultsCalculator.js";
import { SessionSeries } from "../src/core/SessionSeries.js";

describe("PortfolioResultsCalculator", () => {
  function byStrat(results, strat) {
    return results.find((entry) => entry.strat === strat);
  }

  it("calculates portfolio metrics for one tab and one First N", () => {
    const firstNFilter = { filter: jasmine.createSpy("filter").and.callFake((entries) => entries) };

    const movementMapper = {
      map: jasmine.createSpy("map").and.returnValue([
        { action: "buy", date: "2026-01-01", ticker: "AAPL", amount: 1500, positionId: 1 },
        { action: "valueToday", date: "2026-01-02", ticker: "AAPL", amount: 1700, positionId: 1 },
      ]),
    };

    const xirrCalculator = { calculate: jasmine.createSpy("calculate").and.returnValue(0.1234) };
    const weightedAgeCalculator = { calculate: jasmine.createSpy("calculate").and.returnValue(1.234) };

    const calculator = new PortfolioResultsCalculator({
      firstNFilter,
      movementMapper,
      xirrCalculator,
      weightedAgeCalculator,
      logger: { warn: jasmine.createSpy("warn") },
      minDeposit: 1000,
      todayProvider: () => "2026-01-02",
    });

    const results = calculator.calculate(
      [{ name: "Tab A", entries: [{ ticker: "AAPL" }] }],
      [4],
    );

    expect(results.length).toBe(10);
    expect(results.map((entry) => entry.strat)).toEqual([
      "Fixed D", "Fixed S|D", "Full S", "Fixed D + Full S",
      "Smooth S", "Fixed D + Smooth S",
      "Half S", "Fixed D + Half S",
      "Doubling S", "Fixed D + Doubling S",
    ]);

    const result = byStrat(results, "Fixed D");
    expect(result).toEqual({
      top_n: 4,
      tab: "Tab A",
      strat: "Fixed D",
      closed: false,
      asOf: "2026-01-02",
      XIRR: 12.34,
      avg_age_y: 1.23,
      deposited: 1000,
      current: 1013.33,
      invested: 113.33,
      depositCash: 900,
      saleCash: 0,
      cash: 900,
      returns: 1.33,
    });
    const diffRow = result.log.find((row) => row.action === "Diff AAPL");
    expect(diffRow).toBeDefined();
    expect(diffRow.qty).toBeNull();
    expect(diffRow.amount).toBe(13.33);
    expect(result.log.some((row) => row.action.startsWith("Current "))).toBeFalse();
    expect(xirrCalculator.calculate).toHaveBeenCalledTimes(10);
    expect(weightedAgeCalculator.calculate).toHaveBeenCalledTimes(10);
  });

  it("sets XIRR to N/A when xirr calculation fails", () => {
    const calculator = new PortfolioResultsCalculator({
      firstNFilter: { filter: () => [{ id: 1 }] },
      movementMapper: {
        map: () => [
          { action: "buy", date: "2026-01-01", ticker: "AAPL", amount: 1000, positionId: 1 },
          { action: "valueToday", date: "2026-01-02", ticker: "AAPL", amount: 1100, positionId: 1 },
        ],
      },
      xirrCalculator: { calculate: () => { throw new Error("boom"); } },
      weightedAgeCalculator: { calculate: () => 1 },
      logger: { warn: jasmine.createSpy("warn") },
      minDeposit: 1000,
      todayProvider: () => "2026-01-02",
    });

    const result = byStrat(
      calculator.calculate([{ name: "Tab A", entries: [{}] }], [1]),
      "Fixed D",
    );

    expect(result.XIRR).toBe("N/A");
  });

  it("delegates weekly allocation decisions to the injected policy", () => {
    const weeklyInvestmentPolicy = {
      decide: jasmine.createSpy("decide").and.callFake(({ buyCount, depositCash, saleCash }) => {
        if (buyCount === 0) {
          return {
            depositTopUp: 0,
            baseToBuy: 0,
            saleReinvestment: 0,
            targetToBuy: 0,
            investedByPosition: 0,
            investedToday: 0,
            investedFromDeposits: 0,
            investedFromSales: 0,
            nextDepositCash: depositCash,
            nextSaleCash: saleCash,
            nextLastSaleReinvestment: 0,
          };
        }

        return {
          depositTopUp: 1000,
          baseToBuy: 200,
          saleReinvestment: 0,
          targetToBuy: 200,
          investedByPosition: 200,
          investedToday: 200,
          investedFromDeposits: 200,
          investedFromSales: 0,
          nextDepositCash: 800,
          nextSaleCash: 0,
          nextLastSaleReinvestment: 0,
        };
      }),
    };

    const calculator = new PortfolioResultsCalculator({
      firstNFilter: { filter: () => [{ id: 1 }] },
      movementMapper: {
        map: () => [
          { action: "buy", date: "2026-01-01", ticker: "AAA", amount: 1000, positionId: 1 },
          { action: "valueToday", date: "2026-01-02", ticker: "AAA", amount: 1200, positionId: 1 },
        ],
      },
      weeklyInvestmentPolicy,
      xirrCalculator: { calculate: () => 0.1 },
      weightedAgeCalculator: { calculate: () => 1 },
      logger: { warn: jasmine.createSpy("warn") },
      minDeposit: 1000,
      minInvestment: 100,
      todayProvider: () => "2026-01-02",
    });

    const result = byStrat(calculator.calculate(
      [{ name: "Tab Delegation", entries: [{ id: 1 }] }],
      [1],
      { minDeposit: 1000, minInvestment: 100 },
    ), "Fixed D");

    // Verify the new strategy-based call signature for two representative strategies
    expect(weeklyInvestmentPolicy.decide).toHaveBeenCalledWith({
      buyCount: 1,
      depositCash: 0,
      saleCash: 0,
      minDeposit: 1000,
      minInvestment: 100,
      strategy: "Fixed D",
      smoothN: 4,
      lastSaleReinvestment: 0,
      smoothBand: 0,
      smoothWeeksRemaining: 0,
    });
    expect(weeklyInvestmentPolicy.decide).toHaveBeenCalledWith({
      buyCount: 1,
      depositCash: 0,
      saleCash: 0,
      minDeposit: 1000,
      minInvestment: 100,
      strategy: "Doubling S",
      smoothN: 4,
      lastSaleReinvestment: 0,
      smoothBand: 0,
      smoothWeeksRemaining: 0,
    });
    expect(result.deposited).toBe(1000);
    expect(result.invested).toBe(240);
    expect(result.cash).toBe(800);
  });

  it("reinvests sales in multiples while keeping weekly minimum investment from deposits", () => {
    const calculator = new PortfolioResultsCalculator({
      firstNFilter: { filter: () => [{ id: 1 }, { id: 2 }] },
      movementMapper: {
        map: (entry) => {
          if (entry.id === 1) {
            return [
              { action: "buy", date: "2026-01-01", ticker: "AAA", amount: 1000, positionId: 1 },
              { action: "sell", date: "2026-01-02", ticker: "AAA", amount: 1300, positionId: 1 },
            ];
          }
          return [
            { action: "buy", date: "2026-01-03", ticker: "BBB", amount: 1000, positionId: 2 },
            { action: "valueToday", date: "2026-01-04", ticker: "BBB", amount: 1100, positionId: 2 },
          ];
        },
      },
      xirrCalculator: { calculate: () => 0.1 },
      weightedAgeCalculator: { calculate: () => 1 },
      logger: { warn: jasmine.createSpy("warn") },
      minDeposit: 1000,
      minInvestment: 100,
      todayProvider: () => "2026-01-04",
    });

    const result = byStrat(calculator.calculate(
      [{ name: "Tab A", entries: [{ id: 1 }, { id: 2 }] }],
      [2],
      { minDeposit: 1000, minInvestment: 200 },
    ), "Fixed D + Full S");

    expect(result.cash).toBe(660);
    expect(result.invested).toBe(440);
    expect(result.current).toBe(1100);
    expect(result.deposited).toBe(1000);
  });

  it("keeps buy and sell tied to the same position with proportional scaling and expected dates", () => {
    const xirrCalculator = { calculate: jasmine.createSpy("calculate").and.returnValue(0.1) };
    const weightedAgeCalculator = { calculate: jasmine.createSpy("calculate").and.returnValue(1.5) };
    const calculator = new PortfolioResultsCalculator({
      firstNFilter: { filter: (entries) => entries },
      movementMapper: {
        map: (entry) => {
          if (entry.id === 1) {
            return [
              { action: "buy", date: "2026-01-01", ticker: "AAA", amount: 1000, positionId: 11 },
              { action: "sell", date: "2026-01-05", ticker: "AAA", amount: 1200, positionId: 11 },
            ];
          }
          return [
            { action: "buy", date: "2026-01-01", ticker: "AAA", amount: 400, positionId: 22 },
            { action: "valueToday", date: "2026-01-10", ticker: "AAA", amount: 440, positionId: 22 },
          ];
        },
      },
      xirrCalculator,
      weightedAgeCalculator,
      logger: { warn: jasmine.createSpy("warn") },
      minDeposit: 1000,
      minInvestment: 100,
      todayProvider: () => "2026-01-10",
    });

    const result = byStrat(calculator.calculate(
      [{ name: "Tab A", entries: [{ id: 1 }, { id: 2 }] }],
      [5],
      { minDeposit: 1000, minInvestment: 200 },
    ), "Fixed D");

    expect(result.deposited).toBe(1000);
    expect(result.cash).toBe(920);
    expect(result.invested).toBe(110);
    expect(result.current).toBe(1030);
    expect(result.avg_age_y).toBe(1.5);

    expect(weightedAgeCalculator.calculate).toHaveBeenCalledWith([
      { date: "2026-01-01", amount: 1000 },
    ], "2026-01-10");

    expect(xirrCalculator.calculate).toHaveBeenCalledWith([
      { date: "2026-01-01", amount: -1000 },
      { date: "2026-01-10", amount: 1030 },
    ]);
  });

  it("splits minimum investment equally per buy and rounds down to whole euros", () => {
    const calculator = new PortfolioResultsCalculator({
      firstNFilter: { filter: (entries) => entries },
      movementMapper: {
        map: (entry) => [
          { action: "buy", date: "2026-01-01", ticker: entry.id, amount: 100, positionId: entry.id },
          { action: "valueToday", date: "2026-01-02", ticker: entry.id, amount: 100, positionId: entry.id },
        ],
      },
      xirrCalculator: { calculate: () => 0.0 },
      weightedAgeCalculator: { calculate: () => 1 },
      logger: { warn: jasmine.createSpy("warn") },
      minDeposit: 1000,
      minInvestment: 100,
      todayProvider: () => "2026-01-02",
    });

    const result = byStrat(calculator.calculate(
      [{ name: "Tab A", entries: [{ id: 1 }, { id: 2 }, { id: 3 }] }],
      [10],
      { minDeposit: 1000, minInvestment: 200 },
    ), "Fixed D");

    expect(result.deposited).toBe(1000);
    expect(result.invested).toBe(198);
    expect(result.cash).toBe(802);
    expect(result.current).toBe(1000);
    expect(result.returns).toBe(0);
  });

  it("returns zero metrics when there are no processable movements", () => {
    const logger = { warn: jasmine.createSpy("warn") };
    const calculator = new PortfolioResultsCalculator({
      firstNFilter: { filter: () => [] },
      movementMapper: { map: jasmine.createSpy("map") },
      xirrCalculator: { calculate: () => { throw new Error("no flows"); } },
      weightedAgeCalculator: { calculate: jasmine.createSpy("calculate") },
      logger,
      minDeposit: 1000,
      minInvestment: 100,
      todayProvider: () => "2026-01-02",
    });

    const result = byStrat(calculator.calculate([{ name: "Empty Tab", entries: [] }], [4]), "Fixed D");

    expect(result).toEqual({
      top_n: 4,
      tab: "Empty Tab",
      strat: "Fixed D",
      closed: false,
      asOf: "2026-01-02",
      XIRR: "N/A",
      avg_age_y: 0,
      deposited: 0,
      current: 0,
      invested: 0,
      depositCash: 0,
      saleCash: 0,
      cash: 0,
      returns: 0,
    });
    expect(logger.warn).toHaveBeenCalled();
  });

  it("supports multiple deposit top-ups when minimum deposit is below target investment", () => {
    const weightedAgeCalculator = { calculate: jasmine.createSpy("calculate").and.returnValue(2) };
    const xirrCalculator = { calculate: jasmine.createSpy("calculate").and.returnValue(0.2) };
    const calculator = new PortfolioResultsCalculator({
      firstNFilter: { filter: (entries) => entries },
      movementMapper: {
        map: (entry) => [
          { action: "buy", date: "2026-01-01", ticker: entry.ticker, amount: 1000, positionId: entry.id },
          { action: "valueToday", date: "2026-01-02", ticker: entry.ticker, amount: 1200, positionId: entry.id },
        ],
      },
      xirrCalculator,
      weightedAgeCalculator,
      logger: { warn: jasmine.createSpy("warn") },
      minDeposit: 300,
      minInvestment: 1000,
      todayProvider: () => "2026-01-02",
    });

    const result = byStrat(calculator.calculate(
      [{ name: "Tab A", entries: [{ id: 1, ticker: "AAA" }, { id: 2, ticker: "BBB" }] }],
      [2],
      { minDeposit: 300, minInvestment: 1000 },
    ), "Fixed D");

    expect(result.deposited).toBe(1200);
    expect(result.invested).toBe(1200);
    expect(result.cash).toBe(200);
    expect(result.current).toBe(1400);
    expect(result.returns).toBe(16.67);
    expect(result.avg_age_y).toBe(2);
    expect(weightedAgeCalculator.calculate).toHaveBeenCalledWith([
      { date: "2026-01-01", amount: 1200 },
    ], "2026-01-02");
    expect(xirrCalculator.calculate).toHaveBeenCalledWith([
      { date: "2026-01-01", amount: -1200 },
      { date: "2026-01-02", amount: 1400 },
    ]);
  });

  it("tracks deposits from different dates and merges end cash into today's outflow", () => {
    const xirrCalculator = { calculate: jasmine.createSpy("calculate").and.returnValue(0.33) };
    const weightedAgeCalculator = { calculate: jasmine.createSpy("calculate").and.returnValue(0.75) };
    const calculator = new PortfolioResultsCalculator({
      firstNFilter: { filter: (entries) => entries },
      movementMapper: {
        map: (entry) => {
          if (entry.id === 1) {
            return [
              { action: "buy", date: "2026-01-01", ticker: "AAA", amount: 1000, positionId: 1 },
              { action: "valueToday", date: "2026-01-10", ticker: "AAA", amount: 1200, positionId: 1 },
            ];
          }
          return [
            { action: "buy", date: "2026-01-04", ticker: "BBB", amount: 1000, positionId: 2 },
            { action: "valueToday", date: "2026-01-10", ticker: "BBB", amount: 1300, positionId: 2 },
          ];
        },
      },
      xirrCalculator,
      weightedAgeCalculator,
      logger: { warn: jasmine.createSpy("warn") },
      minDeposit: 1000,
      minInvestment: 900,
      todayProvider: () => "2026-01-10",
    });

    const result = byStrat(calculator.calculate(
      [{ name: "Tab B", entries: [{ id: 1 }, { id: 2 }] }],
      [9],
      { minDeposit: 1000, minInvestment: 900 },
    ), "Fixed D");

    expect(result.top_n).toBe(9);
    expect(result.tab).toBe("Tab B");
    expect(result.deposited).toBe(2000);
    expect(result.invested).toBe(2250);
    expect(result.cash).toBe(200);
    expect(result.current).toBe(2450);
    expect(result.returns).toBe(22.5);
    expect(result.avg_age_y).toBe(0.75);
    expect(result.XIRR).toBe(33);
    expect(weightedAgeCalculator.calculate).toHaveBeenCalledWith([
      { date: "2026-01-01", amount: 1000 },
      { date: "2026-01-04", amount: 1000 },
    ], "2026-01-10");
    expect(xirrCalculator.calculate).toHaveBeenCalledWith([
      { date: "2026-01-01", amount: -1000 },
      { date: "2026-01-04", amount: -1000 },
      { date: "2026-01-10", amount: 2450 },
    ]);
  });

  it("can end a day above minimum investment when sells happen after buys on the same day", () => {
    const calculator = new PortfolioResultsCalculator({
      firstNFilter: { filter: (entries) => entries },
      movementMapper: {
        map: () => [
          { action: "buy", date: "2026-01-01", ticker: "AAA", amount: 1000, positionId: 1 },
          { action: "sell", date: "2026-01-01", ticker: "AAA", amount: 2000, positionId: 1 },
        ],
      },
      xirrCalculator: { calculate: () => 0.1 },
      weightedAgeCalculator: { calculate: () => 1 },
      logger: { warn: jasmine.createSpy("warn") },
      minDeposit: 1000,
      minInvestment: 100,
      todayProvider: () => "2026-01-02",
    });

    const result = byStrat(calculator.calculate(
      [{ name: "Tab C", entries: [{ id: 1 }] }],
      [1],
      { minDeposit: 1000, minInvestment: 200 },
    ), "Fixed D + Full S");

    expect(result.deposited).toBe(1000);
    expect(result.cash).toBe(1200);
    expect(result.invested).toBe(0);
    expect(result.current).toBe(1200);
  });

  it("closes the portfolio on the last sale date when no position is left open", () => {
    const xirrCalculator = { calculate: jasmine.createSpy("calculate").and.returnValue(0.2) };
    const weightedAgeCalculator = { calculate: jasmine.createSpy("calculate").and.returnValue(1) };
    const calculator = new PortfolioResultsCalculator({
      firstNFilter: { filter: (entries) => entries },
      movementMapper: {
        map: (entry) => {
          if (entry.id === 1) {
            return [
              { action: "buy", date: "2026-01-01", ticker: "AAA", amount: 1000, positionId: 1 },
              { action: "sell", date: "2026-03-01", ticker: "AAA", amount: 1200, positionId: 1 },
            ];
          }
          return [
            { action: "buy", date: "2026-02-01", ticker: "BBB", amount: 1000, positionId: 2 },
            { action: "sell", date: "2026-02-15", ticker: "BBB", amount: 900, positionId: 2 },
          ];
        },
      },
      xirrCalculator,
      weightedAgeCalculator,
      logger: { warn: jasmine.createSpy("warn") },
      minDeposit: 1000,
      minInvestment: 100,
      todayProvider: () => "2026-09-03",
    });

    const result = byStrat(calculator.calculate(
      [{ name: "Tab Closed", entries: [{ id: 1 }, { id: 2 }] }],
      [2],
      { minDeposit: 1000, minInvestment: 200 },
    ), "Fixed D");

    expect(result.closed).toBeTrue();
    expect(result.asOf).toBe("2026-03-01");
    expect(result.invested).toBe(0);

    const flows = xirrCalculator.calculate.calls.first().args[0];
    expect(flows[flows.length - 1].date).toBe("2026-03-01");
    expect(flows.some((flow) => flow.date === "2026-09-03")).toBeFalse();
    expect(weightedAgeCalculator.calculate).toHaveBeenCalledWith(
      jasmine.any(Array),
      "2026-03-01",
    );
    expect(result.log[result.log.length - 1]).toEqual(
      jasmine.objectContaining({ date: "2026-03-01", action: "Closed" }),
    );
  });

  it("keeps the portfolio open when a position is bought again after selling everything", () => {
    const xirrCalculator = { calculate: jasmine.createSpy("calculate").and.returnValue(0.2) };
    const calculator = new PortfolioResultsCalculator({
      firstNFilter: { filter: (entries) => entries },
      movementMapper: {
        map: (entry) => {
          if (entry.id === 1) {
            return [
              { action: "buy", date: "2026-01-01", ticker: "AAA", amount: 1000, positionId: 1 },
              { action: "sell", date: "2026-02-01", ticker: "AAA", amount: 1200, positionId: 1 },
            ];
          }
          return [
            { action: "buy", date: "2026-03-01", ticker: "BBB", amount: 1000, positionId: 2 },
            { action: "valueToday", date: "2026-09-03", ticker: "BBB", amount: 1100, positionId: 2 },
          ];
        },
      },
      xirrCalculator,
      weightedAgeCalculator: { calculate: () => 1 },
      logger: { warn: jasmine.createSpy("warn") },
      minDeposit: 1000,
      minInvestment: 100,
      todayProvider: () => "2026-09-03",
    });

    const result = byStrat(calculator.calculate(
      [{ name: "Tab Reopened", entries: [{ id: 1 }, { id: 2 }] }],
      [2],
      { minDeposit: 1000, minInvestment: 200 },
    ), "Fixed D");

    expect(result.closed).toBeFalse();
    expect(result.asOf).toBe("2026-09-03");
    expect(result.log[result.log.length - 1].action).toBe("Final snapshot");
  });
  describe("blocked sales", () => {
    // 2025-01-03 is 10% below 2025-01-01 and 2025-01-06 is 5% below 2025-01-02, so with
    // a 2-session lookback both days hold sales back; 2025-01-07 lets them through.
    const indexSeries = new SessionSeries([
      { date: "2025-01-01", value: 100 },
      { date: "2025-01-02", value: 100 },
      { date: "2025-01-03", value: 90 },
      { date: "2025-01-06", value: 95 },
      { date: "2025-01-07", value: 110 },
    ]);

    const history = {
      indexSeries,
      priceSeriesByTicker: new Map([
        [
          "AAPL",
          new SessionSeries([
            { date: "2025-01-06", value: 45 },
            { date: "2025-01-07", value: 60 },
          ]),
        ],
      ]),
    };

    function createCalculator() {
      return new PortfolioResultsCalculator({
        firstNFilter: { filter: (entries) => entries },
        movementMapper: {
          map: () => [
            { action: "buy", date: "2025-01-02", ticker: "AAPL", qty: 10, amount: 1000, positionId: 1 },
            { action: "sell", date: "2025-01-03", ticker: "AAPL", qty: 10, amount: 500, positionId: 1 },
          ],
        },
        xirrCalculator: { calculate: () => 0.1 },
        weightedAgeCalculator: { calculate: () => 1 },
        logger: { warn: () => {} },
        minDeposit: 1000,
        minInvestment: 100,
        todayProvider: () => "2025-01-09",
      });
    }

    function sellRow(result) {
      return result.log.find((row) => row.action.startsWith("Sell "));
    }

    it("sells on the original date when the field is empty", () => {
      const results = createCalculator().calculate(
        [{ name: "Tab A", entries: [{ ticker: "AAPL" }] }],
        [4],
        { saleBlockLookbacks: [] },
        history,
      );

      const result = byStrat(results, "Fixed D");
      expect(sellRow(result)).toEqual(jasmine.objectContaining({
        date: "2025-01-03",
        action: "Sell AAPL",
        amount: 50,
      }));
      expect(result.asOf).toBe("2025-01-03");
    });

    it("delays the sale to the first unblocked session, at that session's price", () => {
      const results = createCalculator().calculate(
        [{ name: "Tab A", entries: [{ ticker: "AAPL" }] }],
        [4],
        { saleBlockLookbacks: [2] },
        history,
      );

      const result = byStrat(results, "Fixed D");
      // The buy invested 100 of a 1000 position, so the sale is scaled by 0.1:
      // 10 shares at 60 on 2025-01-07 instead of 10 at 50 on 2025-01-03.
      expect(sellRow(result)).toEqual(jasmine.objectContaining({
        date: "2025-01-07",
        action: "Sell AAPL (held from 2025-01-03)",
        amount: 60,
      }));
      expect(result.saleCash).toBe(60);
      expect(result.closed).toBeTrue();
      expect(result.asOf).toBe("2025-01-07");
    });

    it("keeps the position open when the sale never unblocks", () => {
      const results = createCalculator().calculate(
        [{ name: "Tab A", entries: [{ ticker: "AAPL" }] }],
        [4],
        { saleBlockLookbacks: [2] },
        {
          indexSeries: new SessionSeries(indexSeries.sessions.filter((session) => session.date <= "2025-01-06")),
          priceSeriesByTicker: new Map([["AAPL", new SessionSeries([{ date: "2025-01-06", value: 45 }])]]),
        },
      );

      const result = byStrat(results, "Fixed D");
      expect(sellRow(result)).toBeUndefined();
      expect(result.closed).toBeFalse();
      expect(result.asOf).toBe("2025-01-09");
      expect(result.saleCash).toBe(0);
      // 10 shares at 45, scaled by the 0.1 the buy was scaled with.
      expect(result.invested).toBe(45);
    });

    // Peak 55 on 01-02, so a 15% stop sits at 46.75: 01-06 closes at 48 and holds, and
    // 01-07 closes at 45 with the index up again, which sells.
    it("closes a position the sheet still holds when the stop hits", () => {
      const calculator = new PortfolioResultsCalculator({
        firstNFilter: { filter: (entries) => entries },
        movementMapper: {
          map: () => [
            { action: "buy", date: "2025-01-02", ticker: "AAPL", qty: 10, amount: 1000, positionId: 1 },
            { action: "valueToday", date: "2025-01-09", ticker: "AAPL", qty: 10, amount: 500, positionId: 1 },
          ],
        },
        xirrCalculator: { calculate: () => 0.1 },
        weightedAgeCalculator: { calculate: () => 1 },
        logger: { warn: () => {} },
        minDeposit: 1000,
        minInvestment: 100,
        todayProvider: () => "2025-01-09",
      });

      const results = calculator.calculate(
        [{ name: "Tab A", entries: [{ ticker: "AAPL" }] }],
        [4],
        { saleBlockLookbacks: [2], trackingStopPct: 15 },
        {
          indexSeries,
          priceSeriesByTicker: new Map([
            [
              "AAPL",
              new SessionSeries([
                { date: "2025-01-02", value: 55 },
                { date: "2025-01-03", value: 50 },
                { date: "2025-01-06", value: 48 },
                { date: "2025-01-07", value: 45 },
              ]),
            ],
          ]),
        },
      );

      const result = byStrat(results, "Fixed D");
      // 10 shares at 45 scaled by the 0.1 the buy was scaled with.
      expect(sellRow(result)).toEqual(jasmine.objectContaining({
        date: "2025-01-07",
        action: "Sell AAPL (stop loss)",
        amount: 45,
      }));
      expect(result.saleCash).toBe(45);
      expect(result.closed).toBeTrue();
      expect(result.asOf).toBe("2025-01-07");
    });

    it("fails when the lookbacks are set but the history is missing", () => {
      const calculator = createCalculator();
      const indexMissing =
        '"Block sales S&P 500 -D" needs the index history: add an "Index hist" tab to the spreadsheet, or clear the field.';
      const pricesMissing =
        '"Block sales S&P 500 -D" needs the price history: add a "Prices hist" tab to the spreadsheet, or clear the field.';
      const tabs = [{ name: "Tab A", entries: [] }];

      expect(() => calculator.calculate(tabs, [4], { saleBlockLookbacks: [2] }, null)).toThrowError(
        `${indexMissing} ${pricesMissing}`,
      );
      expect(() =>
        calculator.calculate(tabs, [4], { saleBlockLookbacks: [2] }, {
          indexSeries: new SessionSeries([]),
          priceSeriesByTicker: new Map(),
        }),
      ).toThrowError(`${indexMissing} ${pricesMissing}`);
      expect(() =>
        calculator.calculate(tabs, [4], { saleBlockLookbacks: [2] }, {
          indexSeries,
          priceSeriesByTicker: new Map(),
        }),
      ).toThrowError(pricesMissing);
    });
  });
});
