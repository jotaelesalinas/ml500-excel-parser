import { FinancialMetrics } from "../../src/calculators/FinancialMetrics.js";

describe("FinancialMetrics", () => {
    describe("xirr", () => {
        it("calculates a positive annualized return", () => {
            const metrics = new FinancialMetrics(() => "2024-01-10");

            const result = metrics.xirr([
                { date: "2024-01-01", amount: -1000 },
                { date: "2025-01-01", amount: 1100 },
            ]);

            expect(result).toBeCloseTo(0.099785, 6);
        });

        it("rejects cash flow lists with fewer than two flows", () => {
            const metrics = new FinancialMetrics(() => "2024-01-10");

            expect(() => metrics.xirr([{ date: "2024-01-01", amount: -1000 }])).toThrowError("At least two cash flows are needed.");
        });

        it("rejects invalid dates or amounts", () => {
            const metrics = new FinancialMetrics(() => "2024-01-10");

            expect(() => metrics.xirr([
                { date: "invalid", amount: -1000 },
                { date: "2025-01-01", amount: 1100 },
            ])).toThrowError("Invalid dates or amounts found.");
        });

        it("rejects flows without a positive amount", () => {
            const metrics = new FinancialMetrics(() => "2024-01-10");

            expect(() => metrics.xirr([
                { date: "2024-01-01", amount: -1000 },
                { date: "2025-01-01", amount: -1100 },
            ])).toThrowError("At least one positive flow is needed.");
        });

        it("rejects flows without a negative amount", () => {
            const metrics = new FinancialMetrics(() => "2024-01-10");

            expect(() => metrics.xirr([
                { date: "2024-01-01", amount: 1000 },
                { date: "2025-01-01", amount: 1100 },
            ])).toThrowError("At least one negative flow is needed.");
        });

        it("rejects flows containing zero amounts", () => {
            const metrics = new FinancialMetrics(() => "2024-01-10");

            expect(() => metrics.xirr([
                { date: "2024-01-01", amount: -1000 },
                { date: "2024-06-01", amount: 0 },
                { date: "2025-01-01", amount: 1100 },
            ])).toThrowError("No zero flows are allowed.");
        });
    });

    describe("avgWeightedAge", () => {
        it("calculates the weighted average age in years", () => {
            const metrics = new FinancialMetrics(() => "2024-01-01");

            const result = metrics.avgWeightedAge([
                { date: "2023-01-01", amount: 100 },
                { date: "2023-07-01", amount: 300 },
            ]);

            expect(result).toBeCloseTo(0.627652, 6);
        });

        it("rejects invalid dates or amounts", () => {
            const metrics = new FinancialMetrics(() => "2024-01-01");

            expect(() => metrics.avgWeightedAge([
                { date: "invalid", amount: 100 },
            ])).toThrowError("Invalid dates or amounts found.");
        });

        it("rejects non-positive flows", () => {
            const metrics = new FinancialMetrics(() => "2024-01-01");

            expect(() => metrics.avgWeightedAge([
                { date: "2023-01-01", amount: 0 },
            ])).toThrowError("All flows must be positive.");
        });
    });
});
