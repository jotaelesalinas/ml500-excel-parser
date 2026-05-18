import { XirrCalculator } from "../src/core/XirrCalculator.js";

describe("XirrCalculator", () => {
  it("calculates a valid rate", () => {
    const calculator = new XirrCalculator();
    const cashflows = [
      { date: "2024-01-01", amount: -1000 },
      { date: "2025-01-01", amount: 1100 },
    ];

    const rate = calculator.calculate(cashflows);

    expect(rate).toBeCloseTo(0.1, 2);
  });

  it("throws when all flows are positive", () => {
    const calculator = new XirrCalculator();
    const cashflows = [
      { date: "2024-01-01", amount: 1000 },
      { date: "2025-01-01", amount: 1100 },
    ];

    expect(() => calculator.calculate(cashflows)).toThrowError("At least one negative flow is needed.");
  });

  it("throws when one flow is zero", () => {
    const calculator = new XirrCalculator();
    const cashflows = [
      { date: "2024-01-01", amount: -1000 },
      { date: "2025-01-01", amount: 0 },
      { date: "2025-02-01", amount: 1100 },
    ];

    expect(() => calculator.calculate(cashflows)).toThrowError("No zero flows are allowed.");
  });
});
