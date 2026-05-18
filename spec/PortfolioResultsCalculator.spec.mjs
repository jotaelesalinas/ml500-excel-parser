import { PortfolioResultsCalculator } from "../src/services/PortfolioResultsCalculator.js";

describe("PortfolioResultsCalculator", () => {
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

    expect(results).toEqual([
      {
        top_n: 4,
        tab: "Tab A",
        XIRR: 12.34,
        avg_age_y: 1.23,
        deposited: 1000,
        current: 1026.67,
        invested: 226.67,
        cash: 800,
        returns: 2.67,
      },
    ]);
    expect(xirrCalculator.calculate).toHaveBeenCalledTimes(1);
    expect(weightedAgeCalculator.calculate).toHaveBeenCalledTimes(1);
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

    const result = calculator.calculate([{ name: "Tab A", entries: [{}] }], [1])[0];

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
      minInvestment: 200,
      todayProvider: () => "2026-01-02",
    });

    const result = calculator.calculate(
      [{ name: "Tab Delegation", entries: [{ id: 1 }] }],
      [1],
      { reinvest: true, minDeposit: 1000, minInvestment: 200 },
    )[0];

    expect(weeklyInvestmentPolicy.decide).toHaveBeenCalledWith({
      buyCount: 1,
      depositCash: 0,
      saleCash: 0,
      minDeposit: 1000,
      minInvestment: 200,
      reinvest: true,
    });
    expect(weeklyInvestmentPolicy.decide).toHaveBeenCalledWith({
      buyCount: 0,
      depositCash: 800,
      saleCash: 0,
      minDeposit: 1000,
      minInvestment: 200,
      reinvest: true,
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
      minInvestment: 200,
      todayProvider: () => "2026-01-04",
    });

    const result = calculator.calculate(
      [{ name: "Tab A", entries: [{ id: 1 }, { id: 2 }] }],
      [2],
      { reinvest: true, minDeposit: 1000, minInvestment: 200 },
    )[0];

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
      minInvestment: 200,
      todayProvider: () => "2026-01-10",
    });

    const result = calculator.calculate(
      [{ name: "Tab A", entries: [{ id: 1 }, { id: 2 }] }],
      [5],
      { reinvest: false, minDeposit: 1000, minInvestment: 200 },
    )[0];

    expect(result.deposited).toBe(1000);
    expect(result.cash).toBe(920);
    expect(result.invested).toBe(110);
    expect(result.current).toBe(1030);
    expect(result.avg_age_y).toBe(1.5);

    expect(weightedAgeCalculator.calculate).toHaveBeenCalledWith([
      { date: "2026-01-01", amount: 1000 },
    ]);

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
      minInvestment: 200,
      todayProvider: () => "2026-01-02",
    });

    const result = calculator.calculate(
      [{ name: "Tab A", entries: [{ id: 1 }, { id: 2 }, { id: 3 }] }],
      [10],
      { reinvest: false, minDeposit: 1000, minInvestment: 200 },
    )[0];

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
      minInvestment: 200,
      todayProvider: () => "2026-01-02",
    });

    const result = calculator.calculate([{ name: "Empty Tab", entries: [] }], [4])[0];

    expect(result).toEqual({
      top_n: 4,
      tab: "Empty Tab",
      XIRR: "N/A",
      avg_age_y: 0,
      deposited: 0,
      current: 0,
      invested: 0,
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

    const result = calculator.calculate(
      [{ name: "Tab A", entries: [{ id: 1, ticker: "AAA" }, { id: 2, ticker: "BBB" }] }],
      [2],
      { reinvest: false, minDeposit: 300, minInvestment: 1000 },
    )[0];

    expect(result.deposited).toBe(1200);
    expect(result.invested).toBe(1200);
    expect(result.cash).toBe(200);
    expect(result.current).toBe(1400);
    expect(result.returns).toBe(16.67);
    expect(result.avg_age_y).toBe(2);
    expect(weightedAgeCalculator.calculate).toHaveBeenCalledWith([
      { date: "2026-01-01", amount: 1200 },
    ]);
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

    const result = calculator.calculate(
      [{ name: "Tab B", entries: [{ id: 1 }, { id: 2 }] }],
      [9],
      { reinvest: false, minDeposit: 1000, minInvestment: 900 },
    )[0];

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
    ]);
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
      minInvestment: 200,
      todayProvider: () => "2026-01-02",
    });

    const result = calculator.calculate(
      [{ name: "Tab C", entries: [{ id: 1 }] }],
      [1],
      { reinvest: true, minDeposit: 1000, minInvestment: 200 },
    )[0];

    expect(result.deposited).toBe(1000);
    expect(result.cash).toBe(1200);
    expect(result.invested).toBe(0);
    expect(result.current).toBe(1200);
  });
});
