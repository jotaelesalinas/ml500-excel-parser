import { PortfolioResultsCalculator } from "../src/services/PortfolioResultsCalculator.js";

describe("PortfolioResultsCalculator", () => {
  it("calculates portfolio metrics for one tab and one First N", () => {
    const firstNFilter = { filter: jasmine.createSpy("filter").and.callFake((entries) => entries) };

    const movementMapper = {
      map: jasmine.createSpy("map").and.returnValue([
        { action: "buy", date: "2026-01-01", ticker: "AAPL", amount: 1500 },
        { action: "valueToday", date: "2026-01-02", ticker: "AAPL", amount: 1700 },
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
        deposited: 2000,
        current: 2200,
        invested: 1700,
        cash: 500,
        returns: 10,
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
          { action: "buy", date: "2026-01-01", ticker: "AAPL", amount: 1000 },
          { action: "valueToday", date: "2026-01-02", ticker: "AAPL", amount: 1100 },
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
});
