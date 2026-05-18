import { WeightedAgeCalculator } from "../src/core/WeightedAgeCalculator.js";

describe("WeightedAgeCalculator", () => {
  it("calculates weighted age", () => {
    const calculator = new WeightedAgeCalculator(() => "2026-01-01");
    const flows = [
      { date: "2024-01-01", amount: 100 },
      { date: "2025-01-01", amount: 100 },
    ];

    const age = calculator.calculate(flows);

    expect(age).toBeCloseTo(1.5, 1);
  });

  it("throws when any flow is non-positive", () => {
    const calculator = new WeightedAgeCalculator(() => "2026-01-01");

    expect(() => calculator.calculate([{ date: "2024-01-01", amount: 0 }])).toThrowError(
      "All flows must be positive.",
    );
  });
});
